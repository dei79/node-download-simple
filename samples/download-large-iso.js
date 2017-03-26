let download = require('../index.js');

download('http://releases.ubuntu.com/16.04.2/ubuntu-16.04.2-server-amd64.iso', '/tmp/ubuntu.iso').progress((progress) => {
    console.log(progress.msg + ' (' + progress.rel + '%)');
}).then(() => {
    console.log('Done');
}).catch((e) => {
    console.log('Error: ' + e);
});