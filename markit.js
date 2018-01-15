const S = require('string')
const emojify = require('./emojify.js')
const cheerio = require('cheerio')
const hljs = require('highlight.js')
const Prism = require('prismjs')
const path = require('path')

function markit(mdText, meta, template) {
    let rendered = md.render(mdText)
    const context = {
        url: 'http://yonggu.me',
        title: meta.title,
        pathBrowser: generatePathBrowser(meta.permalink),
        html: rendered,
        'ui-toc': '',
        'ui-toc-affix': '',
        lang: null,
        dir: null
    }
    const html = template(context)
    let $ = cheerio.load(html);
    finishView($)
    return {html:$.html(),text:$('#doc').text().replace(/\n\s*/g,' ')}
}

function highlightRender(code, lang) {
    if (!lang || /no(-?)highlight|plain|text/.test(lang)) { return }
    code = S(code).escapeHTML().s
        // if (lang === 'sequence') {
        //   return `<div class="sequence-diagram raw">${code}</div>`
        // } else if (lang === 'flow') {
        //   return `<div class="flow-chart raw">${code}</div>`
        // } else if (lang === 'graphviz') {
        //   return `<div class="graphviz raw">${code}</div>`
        // } else if (lang === 'mermaid') {
        //   return `<div class="mermaid raw">${code}</div>`
        // } else if (lang === 'abc') {
        //   return `<div class="abc raw">${code}</div>`
        // }
    const result = {
        value: code
    }
    const showlinenumbers = /=$|=\d+$|=\+$/.test(lang)
    if (showlinenumbers) {
        // console.log("showLineNumbers")
        let startnumber = 1
        const matches = lang.match(/=(\d+)$/)
        if (matches) { startnumber = parseInt(matches[1]) }
        const lines = result.value.split('\n')
        const linenumbers = []
        for (let i = 0; i < lines.length - 1; i++) {
            linenumbers[i] = `<span data-linenumber='${startnumber + i}'></span>`
        }
        const continuelinenumber = /=\+$/.test(lang)
        const linegutter = `<div class='gutter linenumber${continuelinenumber ? ' continue' : ''}'>${linenumbers.join('\n')}</div>`
        result.value = `<div class='wrapper'>${linegutter}<div class='code'>${result.value}</div></div>`
    }
    return result.value
}

const markdownit = require('markdown-it')
const markdownitContainer = require('markdown-it-container')

let md = markdownit('default', {
    html: true,
    breaks: true,
    langPrefix: '',
    linkify: true,
    typographer: true,
    highlight: highlightRender
})

md.use(require('markdown-it-task-lists'))
md.use(require('markdown-it-abbr'))
md.use(require('markdown-it-footnote'))
md.use(require('markdown-it-deflist'))
md.use(require('markdown-it-mark'))
md.use(require('markdown-it-ins'))
md.use(require('markdown-it-sub'))
md.use(require('markdown-it-sup'))
md.use(require('markdown-it-mathjax')({
    beforeMath: '<span class="mathjax raw">',
    afterMath: '</span>',
    beforeInlineMath: '<span class="mathjax raw">\\(',
    afterInlineMath: '\\)</span>',
    beforeDisplayMath: '<span class="mathjax raw">\\[',
    afterDisplayMath: '\\]</span>'
}))
md.use(require('markdown-it-external-links'), {
    externalTarget: "_blank",
    internalDomains: ["blog.yonggu.me", '127.0.0.1', 'localhost']
});
md.use(require('markdown-it-imsize'))
md.use(require('markdown-it-emoji'), {
    shortcuts: {}
})

emojify.setConfig({
    blacklist: {
        elements: ['script', 'textarea', 'a', 'pre', 'code', 'svg'],
        classes: ['no-emojify']
    },
    img_dir: `https://cdnjs.cloudflare.com/ajax/libs/emojify.js/1.1.0/images/basic`,
    // img_dir: `/assets/emojify.js/dist/images/basic`,
    ignore_emoticons: true
})

md.renderer.rules.emoji = (token, idx) => emojify.replace(`:${token[idx].markup}:`)

function renderContainer(tokens, idx, options, env, self) {
    tokens[idx].attrJoin('role', 'alert')
    tokens[idx].attrJoin('class', 'alert')
    tokens[idx].attrJoin('class', `alert-${tokens[idx].info.trim()}`)
    return self.renderToken(...arguments)
}
md.use(markdownitContainer, 'success', { render: renderContainer })
md.use(markdownitContainer, 'info', { render: renderContainer })
md.use(markdownitContainer, 'warning', { render: renderContainer })
md.use(markdownitContainer, 'danger', { render: renderContainer })

md.use(markdownitContainer, 'center', {
    validate: function(params) {
        return params.trim().match(/^center\s*$/);
      },
    render: function(tokens, idx) {
        var m = tokens[idx].info.trim().match(/^center\s*$/);
        if (tokens[idx].nesting === 1) {
            // opening tag
            return '<center>' + '\n';
        } else {
            // closing tag
            return '</center>\n';
        }
    }
});

md.renderer.rules.image = function(tokens, idx, options, env, self) {
    tokens[idx].attrJoin('class', 'raw')
    return self.renderToken(...arguments)
}
md.renderer.rules.list_item_open = function(tokens, idx, options, env, self) {
    tokens[idx].attrJoin('class', 'raw')
    return self.renderToken(...arguments)
}
md.renderer.rules.blockquote_open = function(tokens, idx, options, env, self) {
    tokens[idx].attrJoin('class', 'raw')
    return self.renderToken(...arguments)
}
md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
    tokens[idx].attrJoin('class', 'raw')
    return self.renderToken(...arguments)
}
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
    let langName = ''
    let highlighted

    if (info) {
        langName = info.split(/\s+/g)[0]
        if (/!$/.test(info)) token.attrJoin('class', 'wrap')
        token.attrJoin('class', options.langPrefix + langName.replace(/=$|=\d+$|=\+$|!$|=!$/, ''))
        token.attrJoin('class', 'hljs')
        token.attrJoin('class', 'raw')
    }

    if (options.highlight) {
        highlighted = options.highlight(token.content, langName) || md.utils.escapeHtml(token.content)
    } else {
        highlighted = md.utils.escapeHtml(token.content)
    }

    if (highlighted.indexOf('<pre') === 0) {
        return `${highlighted}\n`
    }

    return `<pre><code${self.renderAttrs(token)}>${highlighted}</code></pre>\n`
}

module.exports = { markit, generatePathBrowser }

function finishView($) {
    let view = $('.markdown-body')
        //     // image href new window(emoji not included)
    const images = view.find('img.raw[src]').removeClass('raw')
    images.each((key, value) => {
            // if it's already wrapped by link, then ignore
            let srcPath = $(value).attr('src')
            srcPath = srcPath.replace('quiver-image-url', 'resources')
            $(value).attr('src', srcPath)

        })
        //     // blockquote
        //   const blockquote = view.find('blockquote.raw').removeClass('raw')
        //   const blockquoteP = blockquote.find('p')
        //   blockquoteP.each((key, value) => {
        //     let html = $(value).html()
        //     html = replaceExtraTags(html)
        //     $(value).html(html)
        //   })
        //     // color tag in blockquote will change its left border color
        //   const blockquoteColor = blockquote.find('.color')
        //   blockquoteColor.each((key, value) => {
        //     $(value).closest('blockquote').css('border-left-color', $(value).attr('data-color'))
        //   })

    // syntax highlighting
    view.find('code.raw').removeClass('raw')
        .each((key, value) => {
            const langDiv = $(value)
                //   console.log(langDiv[0]);
            if (langDiv.length > 0) {
                let lang = langDiv.attr('class');
                const reallang = lang.replace(/hljs|wrap/g, '').trim()
                const codeDiv = langDiv.find('.code')
                let code = ''
                if (codeDiv.length > 0) code = codeDiv.html()
                else code = langDiv.html()
                var result
                if (!reallang) {
                    result = {
                        value: code
                    }
                } else if (reallang === 'haskell' || reallang === 'go' || reallang === 'typescript' || reallang === 'jsx' || reallang === 'gherkin') {
                    code = S(code).unescapeHTML().s
                    result = {
                        value: Prism.highlight(code, Prism.languages[reallang])
                    }
                } else if (reallang === 'tiddlywiki' || reallang === 'mediawiki') {
                    code = S(code).unescapeHTML().s
                    result = {
                        value: Prism.highlight(code, Prism.languages.wiki)
                    }
                } else if (reallang === 'cmake') {
                    code = S(code).unescapeHTML().s
                    result = {
                        value: Prism.highlight(code, Prism.languages.makefile)
                    }
                } else {
                    code = S(code).unescapeHTML().s
                    const languages = hljs.listLanguages()
                    if (!languages.includes(reallang)) {
                        result = hljs.highlightAuto(code)
                    } else {
                        result = hljs.highlight(reallang, code)
                    }
                }
                if (codeDiv.length > 0) codeDiv.html(result.value)
                else langDiv.html(result.value)
            }
        })
        // mathjax
        //   const mathjaxdivs = view.find('span.mathjax.raw').removeClass('raw').toArray()
        //   try {
        //     if (mathjaxdivs.length > 1) {
        //       window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, mathjaxdivs])
        //       window.MathJax.Hub.Queue(window.viewAjaxCallback)
        //     } else if (mathjaxdivs.length > 0) {
        //       window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, mathjaxdivs[0]])
        //       window.MathJax.Hub.Queue(window.viewAjaxCallback)
        //     }
        //   } catch (err) {
        //     console.warn(err)
        //   }
}

function generatePathBrowser(filePath) { //filePath must begin with '/'
    // console.log("generating path browser:", filePath);
    let html = path.basename(filePath).replace('.html', '');
    if (html == 'index') html = ''
    let link = path.dirname(filePath);
    // console.log(html,link);
    while (link != '/') {
        html = `<a href="${link}">${path.basename(link)}</a> / ` + html;
        link = path.dirname(link);
    }
    if (html == '') return ''
    html = `<a href="/">Home</a> / ` + html;
    html = `<div class="path-browser container-fluid">${html}</div>`;
    return html;
}