let download = require('../index.js');

download('http://releases.ubuntu.com/16.04.2/ubuntu-16.04.2-server-amd64.iso?_ga=1.56151659.1163870845.1490546729', '/tmp/ubuntu.iso').progress((progress) => {
    console.log(progress);
}).then(() => {
    console.log('Done');
}).catch((e) => {
    console.log('Error: ' + e);
});