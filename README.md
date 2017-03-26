# Download Simple

Download Simple is a small implementation of a download client which transfers the blocks chunk by chunk. This works
well for large files as well. The client supports automatic following of redirects, network timeouts and progress 
updates based on promisses. 

'''js 
let download = require('download-simple');

download('http://127.0.0.1:1337/aad/link/graphger', '/tmp/demo.html', { timeout: 20 * 1000, maxRedirects: 5 }).progress((progress) => {
    console.log(progress.msg + ' (' + progress.rel + '%)');
}).then(() => {
    console.log('Done');
}).catch((e) => {
    console.log('Error: ' + e);
});
```
