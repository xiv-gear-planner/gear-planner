# Building and Running Locally

## Building

In a command line, run the following commands:
```shell
# Only needed once, or when dependencies change
npm install
# Only needed when code changes
npm run build
# Only needed when CSS changes
npx lessc --source-map ./src/style.less dist/style.css
# Tests
npx ts-mocha src/scripts/test/*test.ts          
```

After making code changes, run `npm run build` again. 
After making CSS changes, run the `npc lessc ...` command from above again. 
Before merging code, run the `npc ts-mocha ...` command again.

## Running

Opening the HTML files alone will not work in most browsers. Instead, you will need to run a local HTTP server.
The easiest way to do so depends on your development environment.

### WebStorm (and other JetBrains products)

In WebStorm, you can simply right-click the `dist/index.html` file, and select Open In > Browser.

### VS Code

In VS Code, you can use addons such as 
[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) to do the equivalent.
The file to open is `dist/index.html`.

### Others

For any other development environment, either use a plugin specific to that editor/IDE, or use a generic
static HTTP server such as Python's `http.server` module, the `jwebserver` included in Java 18+, IIS express,
or any number of others.