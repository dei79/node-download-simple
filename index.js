const Q             = require('q');
const Url           = require('url');
const fs            = require('fs');
const HttpError     = require("standard-http-error");

function download(uri, headersOrTargetFileName, optionalTargetFileName, options) {

    // Arrange the parameters
    let headers = (typeof headersOrTargetFileName === 'string') ? {} : headersOrTargetFileName;
    let target = (typeof headersOrTargetFileName === 'string') ? headersOrTargetFileName : optionalTargetFileName;

    // adapt the options
    options = (typeof optionalTargetFileName === 'string') ? options : optionalTargetFileName;
    options = options ? options : {};

    // set default parameters
    options.timeout = options.timeout ? options.timeout : 60 * 1000;
    options.maxRedirects = (options.maxRedirects === undefined || options.maxRedirects === null) ? 20 : options.maxRedirects;

    // parse the uri
    let parsedUri = Url.parse(uri);

    // get the protocol
    let protocol = parsedUri.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') {
        return Q.reject(new Error('Unknown protocol, only http or https supported'));
    }

    // get the port
    let port = parsedUri.port ? parsedUri.port : (protocol === 'https' ? 443 : 80);

    // get the host
    let host = parsedUri.hostname;

    // get the path
    let path = parsedUri.path;

    // build the request options for the MS web service
    var requestOptions = {
        method: 'GET',
        host: host,
        port: port,
        path: path,
        headers: headers
    };

    // get the right protocol handler
    let protocolClient = require(protocol);

    // generate a new defered call
    let defer = Q.defer();

    // get time before request
    let beforeRequestDate = new Date();

    // initialize the request
    var protocolRequest = protocolClient.request(requestOptions, (response) => {

        // support 302 redirectors
        if (response && (response.statusCode === 302 ||response.statusCode === 301)) {

            // get the redirectcount
            let redirectCount = options.redirectCount ? options.redirectCount : 0;

            if (redirectCount >= options.maxRedirects) {
                return defer.reject(new HttpError(500, 'To many redirects, limit of ' + options.maxRedirects + ' exceeded'));
            } else {
                // notify the progress
                defer.notify({
                    msg: 'Redirecting to ' + response.headers.location + ', Redirect-Count: ' + redirectCount,
                    size: 0, current: 0, rel: 0
                });

                // redirect
                download(response.headers.location, headersOrTargetFileName, optionalTargetFileName, {redirectCount: redirectCount + 1}).progress((progress) => {
                    return defer.notify(progress);
                }).then(() => {
                    return defer.resolve();
                }).catch((e) => {
                    return defer.reject(e);
                });
            }

        // check error code
        } else if (response && (response.statusCode < 200 && response.statusCode > 299)) {
            return defer.reject(new HttpError(response.statusCode, 'Failed to download file'));

        // Download totally
        } else {

            // get time after first bytes
            let afterFirstBytesRequestDate = new Date();

            // notify the progress
            defer.notify({
                msg: 'Received first bytes from server after ' + (afterFirstBytesRequestDate - beforeRequestDate) + ' ms...',
                size: 0, current: 0, rel: 0
            });

            // ensure we can create the file stream
            var targetFileStream = fs.createWriteStream(target);

            // get the full size
            let progressInformation = {
                msg: 'Copying chunks...',
                size: response.headers['content-length'] ? parseInt(response.headers['content-length']) : 0,
                current: 0,
                rel: 0
            };

            response.on('data', function (chunk) {

                // write the file
                targetFileStream.write(chunk);

                // calculate the progress
                progressInformation.current += chunk.length;
                if (progressInformation.size > 0) { progressInformation.rel = (progressInformation.current / progressInformation.size) * 100; }

                // notify the progress
                defer.notify(progressInformation);
            });

            response.on('end', function () {

                // close our file stream
                targetFileStream.end();

                // done
                defer.resolve();
            })
        }
    });

    // let us return the correct timeout error code
    let isTimedOut = false;

    // handle the socket to set a timeout
    protocolRequest.on('socket', function (socket) {

        // notify the progress
        defer.notify({
            msg: 'Established Socket connection, timeout set to ' + options.timeout + ' ms...',
            size: 0, current: 0, rel: 0
        });

        // set out standard timeout (60 seconds) or the timeout from the options
        if (options.timeout !== -1) { socket.setTimeout(options.timeout); }

        // wait for the timeout
        socket.on('timeout', () => {

            // mark as timed out
            isTimedOut = true;

            // abort the request
            protocolRequest.abort();
        });
    });

    // init the error handler
    protocolRequest.on('error', (err) => {
        if (isTimedOut) {
            return defer.reject(new HttpError(599, 'Network connect timeout'));
        } else {
            return defer.reject(new HttpError(500, 'Unknown error', err));
        }
    });

    // start the download
    protocolRequest.end();

    // return the promise
    return defer.promise;
}

exports = module.exports = download;