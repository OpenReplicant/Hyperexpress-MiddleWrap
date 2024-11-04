import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';

/**
 * @typedef {Object} WrapperOptions
 * @property {Console} [logger] - Custom logger (default: console)
 * @property {function} [errorHandler] - Custom error handler function
 */

/**
 * Creates a readable stream from the request body
 * @param {Object} request - HyperExpress request object
 * @returns {Promise<Readable>}
 */
const createBodyStream = async (request) => {
    const readable = new Readable();
    readable._read = () => {};
    
    try {
        const body = await request.text();
        readable.push(Buffer.from(body));
        readable.push(null);
    } catch (err) {
        readable.destroy(err);
    }
    
    return readable;
};

/**
 * Wraps an Express middleware for use with HyperExpress
 * @param {function} expressMiddleware - Express middleware to wrap
 * @param {WrapperOptions} [options] - Options for the wrapper
 * @returns {function} - HyperExpress compatible middleware
 */
const wrapExpressMiddleware = (expressMiddleware, options = {}) => {
    const { 
        logger = console,
        errorHandler = (err, req, res) => {
            res.status(500).json({ error: err.message });
        }
    } = options;

    return (request, response, next) => {
        let nextCalled = false;
        let responseSent = false;

        const callNext = (error) => {
            if (!nextCalled) {
                nextCalled = true;
                next(error);
            }
        };

        const req = {
            ...request,
            app: { locals: {} },
            baseUrl: request.base,
            body: undefined,
            cookies: {},
            fresh: false,
            hostname: request.hostname,
            ip: request.ip,
            ips: [request.ip],
            method: request.method,
            originalUrl: request.url,
            params: request.path_parameters,
            path: request.path,
            protocol: request.protocol,
            query: request.query_parameters,
            route: {},
            secure: request.secure,
            signedCookies: {},
            stale: true,
            subdomains: [],
            xhr: false,
            
            accepts: () => {},
            acceptsCharsets: () => {},
            acceptsEncodings: () => {},
            acceptsLanguages: () => {},
            get: (header) => request.headers[header.toLowerCase()],
            is: () => {},
            range: () => {},
        };

        const res = {
            ...response,
            app: { locals: {} },
            headersSent: false,
            locals: {},
            
            append: (field, value) => {
                if (!responseSent) {
                    const prev = response.getHeader(field);
                    const val = Array.isArray(prev) ? prev.concat(value)
                        : Array.isArray(value) ? [prev].concat(value)
                        : [prev, value];
                    response.header(field, val);
                }
                return res;
            },
            attachment: (filename) => {
                if (!responseSent) {
                    response.header('Content-Disposition', filename ? `attachment; filename="${filename}"` : 'attachment');
                }
                return res;
            },
            cookie: (name, value, options) => {
                if (!responseSent) {
                    let cookie = `${name}=${value}`;
                    if (options) {
                        if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
                        if (options.domain) cookie += `; Domain=${options.domain}`;
                        if (options.path) cookie += `; Path=${options.path}`;
                        if (options.secure) cookie += '; Secure';
                        if (options.httpOnly) cookie += '; HttpOnly';
                        if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
                    }
                    response.header('Set-Cookie', cookie);
                }
                return res;
            },
            clearCookie: (name, options) => {
                if (!responseSent) {
                    const opts = { ...options, expires: new Date(1), path: '/' };
                    return res.cookie(name, '', opts);
                }
                return res;
            },
            end: (data) => {
                if (!responseSent) {
                    responseSent = true;
                    response.send(data);
                    callNext();
                }
            },
            get: (field) => response.getHeader(field),
            json: (body) => {
                if (!responseSent) {
                    responseSent = true;
                    response.json(body);
                    callNext();
                }
            },
            location: (url) => {
                if (!responseSent) {
                    response.header('Location', url);
                }
                return res;
            },
            redirect: (status, url) => {
                if (!responseSent) {
                    responseSent = true;
                    if (typeof status === 'string') {
                        url = status;
                        status = 302;
                    }
                    response.status(status).header('Location', url).send();
                    callNext();
                }
            },
            send: (body) => {
                if (!responseSent) {
                    responseSent = true;
                    response.send(body);
                    callNext();
                }
            },
            sendStatus: (code) => {
                if (!responseSent) {
                    responseSent = true;
                    response.status(code).send(String(code));
                    callNext();
                }
            },
            set: (field, value) => {
                if (!responseSent) {
                    response.header(field, value);
                }
                return res;
            },
            setHeader: (field, value) => {
                if (!responseSent) {
                    response.header(field, value);
                }
                return res;
            },
            status: (code) => {
                if (!responseSent) {
                    response.status(code);
                }
                return res;
            },
            type: (type) => {
                if (!responseSent) {
                    response.type(type);
                }
                return res;
            },
            vary: (field) => {
                if (!responseSent) {
                    response.header('Vary', field);
                }
                return res;
            },
            getHeader: (field) => response.getHeader(field),
            removeHeader: (field) => {
                if (!responseSent) {
                    response.removeHeader(field);
                }
                return res;
            },

            download: (filePath, filename, options, callback) => {
                if (typeof options === 'function') {
                    callback = options;
                    options = {};
                }
                if (typeof filename === 'function') {
                    callback = filename;
                    filename = path.basename(filePath);
                }
                
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        if (callback) {
                            callback(err);
                        } else {
                            errorHandler(err, req, res);
                        }
                        return;
                    }

                    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
                    response.header('Content-Type', mimeType);
                    response.header('Content-Disposition', `attachment; filename="${filename}"`);
                    response.header('Content-Length', stats.size);

                    const fileStream = fs.createReadStream(filePath);
                    response.stream(fileStream);

                    if (callback) {
                        callback(null);
                    }
                });
            },

            sendFile: (filePath, options, callback) => {
                if (typeof options === 'function') {
                    callback = options;
                    options = {};
                }

                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        if (callback) {
                            callback(err);
                        } else {
                            errorHandler(err, req, res);
                        }
                        return;
                    }

                    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
                    response.header('Content-Type', mimeType);
                    response.header('Content-Length', stats.size);

                    const fileStream = fs.createReadStream(filePath);
                    response.stream(fileStream);

                    if (callback) {
                        callback(null);
                    }
                });
            },

            jsonp: (obj) => {
                const callbackName = req.query.callback || 'callback';
                const jsonString = JSON.stringify(obj);
                const body = `${callbackName}(${jsonString});`;
                response.type('application/javascript').send(body);
            }
        };
        // If HyperExpress has a render method, use it
        if (typeof response.render === 'function') {
            res.render = response.render.bind(response);
        }

        const expressNext = (error) => {
            if (error) {
                logger.error('Express middleware error:', error);
                errorHandler(error, req, res);
                callNext(error);
            } else if (!responseSent) {
                callNext();
            }
        };

        createBodyStream(request).then(bodyStream => {
            req.read = bodyStream.read.bind(bodyStream);
            req.pipe = bodyStream.pipe.bind(bodyStream);
            req.unpipe = bodyStream.unpipe.bind(bodyStream);
            req.on = bodyStream.on.bind(bodyStream);
            req.once = bodyStream.once.bind(bodyStream);
            req.removeListener = bodyStream.removeListener.bind(bodyStream);

            logger.debug(`Executing middleware for ${req.method} ${req.path}`);
            
            try {
                const result = expressMiddleware(req, res, expressNext);
                if (result && typeof result.then === 'function') {
                    result.catch(expressNext);
                }
            } catch (err) {
                expressNext(err);
            }
        }).catch(err => {
            logger.error('Error creating body stream:', err);
            callNext(err);
        });
    };
};

/**
 * Wraps multiple Express middlewares for use with HyperExpress
 * @param {...function} middlewares - Express middlewares to wrap
 * @returns {function[]} - Array of HyperExpress compatible middlewares
 */
const wrapExpressMiddlewares = (...middlewares) => {
    return middlewares.map(wrapExpressMiddleware);
};

export { wrapExpressMiddleware, wrapExpressMiddlewares };