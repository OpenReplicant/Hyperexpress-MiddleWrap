# Express.js Middleware Wrapper for HyperExpress

### `Hyper-Express-MiddleWrap`

**EXPERIMENTAL!** Test your server!

This wrapper allows you to use (just about any*) Express middleware in a HyperExpress app just as you'd expect to. It should now be possible to port an Express.js app to HyperExpress by swapping out the app object constructor and wrapping all middleware.

In case you aren't aware, HyperExpress is one of the highest-performing Node.JS servers, being built on a multi-threaded C++ library, delivering throughput on par with Golang servers, and a developer experience very close to Express.js. *Well, now it's even closer.*

## Usage

```javascript
import { wrapExpressMiddleware } as wrap from './hyperexpress-middlewrap.js';
import someExpressMiddleware from 'some-express-middleware';

import HyperExpress from 'hyper-express';
const app = new HyperExpress.Server();

// Example: Wrap and use a single or many middleware
app.use(wrap(someExpressMiddleware));
app.use( wrap(middleware1), wrap(middleware2) );

// Example: Protected route with auth
app.put('/protected',
  wrap(authMiddleware), (req, res) => { ... });

// Example: Multiple middlewares per route
app.get('/admin', 
  wrap(authMiddleware),
  wrap(rbacMiddleware('admin')), 
  (req, res) => { ... });
```


## Notes

- This wrapper attempts to emulate the Express.js environment, but there may be some differences or unsupported features.
- For best performance, use native HyperExpress methods/middleware when possible.
- Error handling is included, but you should test thoroughly with your specific middleware.
- Not yet tested with template/view engines using 'render' but intended to work with native or wrapped since I recently implemented a (Hyper) Handlebars.js view engine modeled after the Express middleware.


## To do

- Test with more Express middleware & validate all methods perform as expected.
- Benchmark any performance losses against 'native HyperExpress' implementations. (views? sessions?)
