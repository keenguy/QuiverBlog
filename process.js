const klaw = require('klaw')
const path = require('path')
const fs = require('fs-extra')
const sanitize = require("sanitize-filename")
const {markit,generatePathBrowser} = require('./markit.js')
const Handlebars = require('handlebars')

// prepare
let noteTemFile = fs.readFileSync(`views/html-cdn.hbs`, 'utf-8')
const noteTem = Handlebars.compile(noteTemFile)
let bookIndexTemFile = fs.readFileSync(`views/bookIndex.hbs`, 'utf-8')
const bookIndexTem = Handlebars.compile(bookIndexTemFile)
let tagIndexTemFile = fs.readFileSync(`views/tags.hbs`, 'utf-8')
const tagIndexTem = Handlebars.compile(tagIndexTemFile)
let searchPageTemFile = fs.readFileSync(`views/search.hbs`, 'utf-8')
const searchPageTem = Handlebars.compile(searchPageTemFile)

    // let libDir = 'Quiver.qvlibrary'
let srcDir = 'src'
let outputDir = 'public'

let site = { books: {}, notes:{}, tags:{} }

let cwd = process.cwd();

function generate(config) {
    site.config = config
    console.log("building...")
    klaw(config.qvlibrary, { depthLimit: 2 }).on('data', (item) => {
        let dirName = path.dirname(item.path)
        let baseName = path.basename(item.path)

        if (baseName == 'meta.json') {
            let meta = require(item.path)
                // console.dir(meta)
            if (meta.children) return; // top-level:library
            if (meta.name) { //notebook
                if (config.books.indexOf(meta.name) < 0 ) return    //not ready to be published
                let bookDir = sanitize(meta.name)
                let bookData = { name: meta.name, notes: [] }
                site.books[meta.uuid] = bookData
                    // console.log(meta.uuid)
            } else { //note
                let bookid = item.path.split(path.sep).slice(-3, -2)[0].split('.')[0]
                if (!(site.books[bookid]) ) return    //not ready to be published
                let bookName = site.books[bookid].name
                let content = require(path.join(path.dirname(item.path), 'content.json'))
                let mdText = content.cells.map((cell) => {
                    if (cell.type == 'markdown' ||cell.type == 'text') {  // 'text' is actually in html format, markdown-it can process it as markdown format
                        return cell.data
                    }else if (cell.type == 'code'){
                        return '```' + cell.language + '=\n' + cell.data + '\n```'
                    }else{
                        return ''
                    }
                }).join('\n\n')

                let mdFileName = `${sanitize(meta.title)}.md`
                let htmlFileName = mdFileName.replace('.md','.html')

                
                let bookDirName =  sanitize(bookName)
                let bookDir = path.join(process.cwd(), outputDir, bookDirName)
                meta.permalink = `/${bookDirName}/${htmlFileName}`
 
                if (bookDirName == "Blog"){
                    bookDir = path.join(cwd,outputDir)
                    meta.permalink = `/${htmlFileName}`
                    meta.title = config.name
                }

                // process tags
                if (meta.tags && meta.tags.length > 0){
                    meta.tags.forEach((tag)=>{
                        if (!(tag in site.tags)){
                            site.tags[tag] = [meta.permalink]
                        }else{
                            site.tags[tag].push(meta.permalink)
                        }
                    })
                }

                
                let mdFilePath = path.join(bookDir, mdFileName)
                    // fs.outputFile(mdFilePath, mdText)
                let resPath = path.join(dirName, 'resources')
                let resPathTo = path.join(bookDir, 'resources')
                fs.pathExists(resPath).then((exists) => { if (exists) { fs.copy(resPath, resPathTo, { overwrite: true }) } })

                meta.created_at = timestampToDate(meta.created_at)
                meta.updated_at = timestampToDate(meta.updated_at)
                let note = Object.assign({},meta)
                
                if(htmlFileName != 'index.html'){  //index.html should not be searched
                site.notes[meta.permalink] = note
                site.books[bookid].notes.push(meta.permalink)
                }

                // mark
                let {html, text} = markit(mdText, meta, noteTem)
                note.text = text
                
                let htmlFilePath = path.join(bookDir, htmlFileName)
                fs.outputFile(htmlFilePath, html)
            }
        }
    }).on('end', () => {
        console.log("Library generated sucessfully !")
        fs.outputFile("tags.json",JSON.stringify(site.tags))
        generateBookIndex()
        generateTagIndex()
        generateSearchPage()
        fs.outputFile(path.join(cwd,outputDir,"notes.json"),JSON.stringify(Object.values(site.notes)))
    })

    fs.copy('src', outputDir, { overwrite: false }).catch(err => {
        console.log(`copy src error:`)
        console.error(err)
    })
}

function generateSearchPage(){
    let html = searchPageTem({pathBrowser:generatePathBrowser("/search.html")})
    let filePath = path.join(outputDir,'search.html')
    fs.outputFile(filePath,html)
}
function generateTagIndex(){
    Handlebars.registerHelper('note', function(permalink) {
        return `<div class="note-overview">${site.notes[permalink].updated_at} | <a href="${site.notes[permalink].permalink}">${site.notes[permalink].title}</a></div>`
      });
    let html = tagIndexTem({site:site, pathBrowser: generatePathBrowser("/tags.html") })
    let filePath = path.join(outputDir,'tags.html')
    fs.outputFile(filePath,html)
}
function generateBookIndex() {
    for (var bookid in site.books) {
        let bookData = site.books[bookid]
        let title = bookData.name
        if (title == 'Blog') continue
        let relPath = path.join('/',sanitize(title), 'index.html')
        let body = `<div class="book-index"><ol>`
        bookData.notes.forEach((link) => {
            let note = site.notes[link]
            let fileName = `${sanitize(note.title)}.html`
            body += `<li><a href="./${fileName}">${note.title}</a></li>`
        })
        body += '</ol></div>'
        const context = {
            url: 'http://yonggu.me',
            title: title,
            pathBrowser: generatePathBrowser(relPath),
            body: body,
            'ui-toc': '',
            'ui-toc-affix': '',
            lang: null,
            dir: null
        }
        let html = bookIndexTem(context)
        let filePath = path.join(cwd, outputDir, relPath)
        fs.outputFile(filePath, html)
    }
}
module.exports = { generate, deploy }

async function deploy(config) {
    const repo = config.publicRepo;
    if (!repo) {
        console.log("Deploy failed: no git repository.");
    }
    console.log(`deploying to ${repo}...`)
    const branch = 'master';

    const git = require('simple-git')(path.join(cwd,outputDir))
        .outputHandler(function(command, stdout, stderr) {
            stderr.pipe(process.stderr);
        })
    await git.checkIsRepo((err,isRepo) => !isRepo && initialiseRepo(git))
    git.add('.')
    .commit("commit by QuiverBlog.")
    .push(['-f','blog-repo', branch]);

    function initialiseRepo(git) {
        return git.init().addRemote('blog-repo', repo)
    }
}

function timestampToDate(ts){
    var t = new Date(ts * 1000);
    return t.toISOString().replace(/T.*/,'')
}