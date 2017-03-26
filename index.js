const Q             = require('q');
const Url           = require('url');
const fs            = require('fs');
const HttpError     = require("standard-http-error");

function download(uri, headersOrTargetFileName, optionalTargetFileName) {

    // Arrange the parameters
    let headers = (typeof headersOrTargetFileName === 'string') ? {} : headersOrTargetFileName;
    let target = (typeof headersOrTargetFileName === 'string') ? headersOrTargetFileName : optionalTargetFileName;

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
    let host = parsedUri.host;

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

    // initialize the request
    var protocolRequest = protocolClient.request(requestOptions, (response) => {

        // support 302 redirectors
        if (response && (response.statusCode === 302 ||response.statusCode === 301)) {
            download(response.headers.location, headersOrTargetFileName, optionalTargetFileName).progress((progress) => {
                return defer.notify(progress);
            }).then(() => {
                return defer.resolve();
            }).catch((e) => {
                return defer.reject(e);
            });

        // check error code
        } else if (response && (response.statusCode < 200 && response.statusCode > 299)) {
            return defer.reject(new HttpError(response.statusCode, 'Failed to download file'));

        // Download totally
        } else {

            // ensure we can create the file stream
            var targetFileStream = fs.createWriteStream(target);

            // get the full size
            let progressInformation = {
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

    // init the error handler
    protocolRequest.on('error', (err) => {
        return defer.reject(new HttpError(500, 'Unknown error', err));
    });

    // start the download
    protocolRequest.end();

    // return the promise
    return defer.promise;
}

exports = module.exports = download;