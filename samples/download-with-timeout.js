let download = require('../index.js');

let timeout = 20 * 1000; // 20 seconds

download('http://127.0.0.1:1337/aad/link/graphger', '/tmp/demo.html', { timeout: timeout, maxRedirects: 5 }).progress((progress) => {
    console.log(progress.msg + ' (' + progress.rel + '%)');
}).then(() => {
    console.log('Done');
}).catch((e) => {
    console.log('Error: ' + e);
});