const fs = require("fs");
const http = require("http");
const url = require('url');
const AV = require("leancloud-storage");
const formidable = require('formidable');
const mime = require("mime");

if (process.env.serverURL) {
    AV.init({
        appId: process.env.appId, appKey: process.env.appKey, serverURL: process.env.serverURL
    });
} else {
    AV.init({
        appId: process.env.appId, appKey: process.env.appKey
    });
}
http.createServer(function (req, res) {
    res.cookie = function (id, value, json = {path: '/', maxAge: null, expires: null, domain: null}) {
        if (json.maxAge) {
            json.maxAge = '; max-age=' + json.maxAge;
        } else {
            json.maxAge = '';
        }
        if (json.expires) {
            json.expires = '; expires=' + json.expires;
        } else {
            json.expires = '';
        }
        if (json.domain) {
            json.domain = '; domain=' + json.domain;
        } else {
            json.domain = '';
        }
        if (!json.path) {
            json.path = '/';
        }
        this.setHeader('set-cookie', id + '=' + value + '; path=' + json.path + json.maxAge + json.expires + json.domain);
    }
    res.clearCookie = function (id, path = '/') {
        this.setHeader('set-cookie', id + '=; maxAge=0; path=' + path);
    }
    req.url = url.parse(req.url)
    res.getQueryVariable = function (variable, err) {
        if (req.url.query) {
            var vars = req.url.query.split("&");
            for (var i = 0; i < vars.length; i++) {
                var pair = vars[i].split("=");
                if (pair[0] == variable) {
                    return decodeURIComponent(pair[1]);
                }
            }
        }
        return (err);
    }

    function cookie2json() {
        req.cookie = {}
        if (req.headers.cookie && req.headers.cookie.indexOf('=') != -1) {
            if (req.headers.cookie.indexOf('; ') != -1) {
                var x = req.headers.cookie.split("; ");
            } else {
                var x = [req.headers.cookie];
            }
            for (let i = 0; i < x.length; i++) {
                req.cookie[x[i].split('=')[0]] = x[i].split('=')[1];
            }
        }
    }

    cookie2json()

    function getImg(req, res) {
        var pattern = new RegExp(process.env.pattern)
        const query = new AV.Query('img');
        query.equalTo('path', req.url.pathname);
        query.find().then((img) => {
            if (img.length > 0) {
                console.log(img[0].get('anti_theft_link'), req.headers.referer)
                if (img[0].get('anti_theft_link')) {
                    if (req.headers.referer) {
                        if (pattern.test(req.headers.referer)) {
                            res.writeHead(200, {
                                'Content-Type': img[0].get('type'),
                                'Access-Control-Allow-Credentials': 'true',
                                'Access-Control-Allow-Origin': '*'
                            });
                            res.end(new Buffer.from(img[0].get('base64'), 'base64'));
                        } else {
                            const query = new AV.Query('img');
                            query.equalTo('path', '/anti_theft_link.png');
                            query.find().then((img) => {
                                if (img.length > 0) {
                                    res.writeHead(200, {
                                        'Content-Type': img[0].get('type'),
                                        'Access-Control-Allow-Credentials': 'true',
                                        'Access-Control-Allow-Origin': '*'
                                    });
                                    res.end(new Buffer.from(img[0].get('base64'), 'base64'));
                                } else {
                                    res.end('');
                                }
                            });
                        }
                    } else {
                        const query = new AV.Query('img');
                        query.equalTo('path', '/anti_theft_link.png');
                        query.find().then((img) => {
                            if (img.length > 0) {
                                res.writeHead(200, {
                                    'Content-Type': img[0].get('type'),
                                    'Access-Control-Allow-Credentials': 'true',
                                    'Access-Control-Allow-Origin': '*'
                                });
                                res.end(new Buffer.from(img[0].get('base64'), 'base64'));
                            } else {
                                res.end('');
                            }
                        });
                    }
                } else {
                    res.writeHead(200, {
                        'Content-Type': img[0].get('type'),
                        'Access-Control-Allow-Credentials': 'true',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(new Buffer.from(img[0].get('base64'), 'base64'));
                }
            } else {
                const query = new AV.Query('img');
                query.equalTo('path', '/404.png');
                query.find().then((img) => {
                    if (img.length > 0) {
                        res.writeHead(200, {
                            'Content-Type': img[0].get('type'),
                            'Access-Control-Allow-Credentials': 'true',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(new Buffer.from(img[0].get('base64'), 'base64'));
                    } else {
                        res.end('');
                    }
                });
            }
        });
    }

    function upload(req, res) {
        const form = formidable({multiples: true});
        form.parse(req, function (err, fields, files) {
            try {
                if (err) {
                    res.writeHead(err.httpCode || 400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(err));
                    return;
                }
                if ('file' in files && 'key' in fields && 'anti_theft_link' in fields) {
                    if ('path' in fields) {
                        path = fields['path']
                    } else {
                        path = '/' + new Date().getTime() + '.' + mime.getExtension(files['file'].type);
                    }
                    if (files['file'].size > 3145728) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({code: 500, msg: '图片过大,当前大小' + files['file'].size + 'B'}));
                        return;
                    }
                    // 声明 class
                    const File = AV.Object.extend('img');
                    const file = new File();
                    file.set('path', path);
                    file.set('type', files['file'].type);
                    console.log(files['file'].filepath)
                    console.log(fs.readFileSync(files['file'].filepath))
                    console.log(fs.readFileSync(files['file'].filepath).toString('base64'))
                    file.set('base64', fs.readFileSync(files['file'].filepath).toString('base64'));
                    file.set('anti_theft_link', fields['anti_theft_link']);
                    file.save().then(() => {
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({code: 200, msg: '保存成功！', url: path}));
                    }, (error) => {
                        res.writeHead(500, {'Content-Type': 'application/json'})
                        res.end(JSON.stringify({code: 500, msg: error}));
                    });
                } else {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({code: 500, msg: '少参数！'}));

                }
            } catch (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({code: 500, msg: err}));
                console.log(err);
            }
        });
    }

    if (req.url.pathname === '/api/upload') {
        upload(req, res);
    } else {
        getImg(req, res)
    }
}).listen(80);
