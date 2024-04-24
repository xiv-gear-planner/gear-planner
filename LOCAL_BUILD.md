# Building and Running Locally

## Building

In a command line, run the following commands:
```shell
# Only needed once, or when dependencies change
npm install
# Build/rebuild
npm run build
# This is a faster way to rebuild just the CSS if that's all you've changed
npx lessc --source-map ./src/style.less dist/style.css
# Run tests
npm test
```

After making code changes, run `npm run build` again. 
After making CSS changes, run the `npc lessc ...` command from above again. 
Before merging code, run the `npm test` command again.

## Running

Opening the HTML files alone will not work in most browsers. Instead, you will need to run a local HTTP server.
The easiest way to do so depends on your development environment.

### WebStorm (and other JetBrains products)

In WebStorm, you can simply right-click the `packages/frontend/dist/index.html` file, and select Open In > Browser.

### VS Code

In VS Code, you can use addons such as 
[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) to do the equivalent.
The file to open is `packages/frontend/dist/index.html`.

### Others

For others, there is a built-in npm script to launch a server. You can run `npm run serve` and then
navigate to [http://localhost:8076/](http://localhost:8076/).