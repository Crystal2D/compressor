const FS = require("fs/promises");
const SyncFS = require("fs");
const { minify } = require("terser");


const minifyConfig = {
    compress: {
        dead_code: true,
        drop_console: false,
        drop_debugger: false,
        keep_classnames: true,
        keep_fargs: true,
        keep_fnames: true,
        keep_infinity: false
    },
    mangle: {
        eval: false,
        keep_classnames: true,
        keep_fnames: true,
        toplevel: false,
        safari10: false
    },
    module: false,
    sourceMap: false,
    output: { comments: false }
};


async function main ()
{
    console.log("Getting output ready...");

    await FS.rm("output", { recursive : true, force : true });
    await FS.mkdir("output");

    console.log("Creating index...");

    await FS.copyFile("cached/index.html", "output/index.html");

    await FS.mkdir("output/js");

    const Application = await FS.readFile("input/js/Application.js", "utf8");
    const Window = await FS.readFile("input/js/Window.js", "utf8");
    const BlankEngine = await FS.readFile("input/js/BlankEngine.js", "utf8");
    const mainScript = await FS.readFile("input/js/main.js", "utf8");

    await FS.writeFile("output/js/main.js", `${await Minify(Application)}${await Minify(Window)}${await Minify(BlankEngine)}${await Minify(mainScript)}`);

    const package = JSON.parse(await FS.readFile("input/package.json", "utf8"));

    if (([null, "Untitled"]).includes(package.window.title)) package.window.title = undefined;
    if (([null, 250]).includes(package.window.width)) package.window.width = undefined;
    if (([null, 250]).includes(package.window.height)) package.window.height = undefined;
    if (([null, 0]).includes(package.window.windowWidth)) package.window.windowWidth = undefined;
    if (([null, 0]).includes(package.window.windowHeight)) package.window.windowHeight = undefined;
    if (([null, 0]).includes(package.window.marginWidth)) package.window.marginWidth = undefined;
    if (([null, 0]).includes(package.window.marginHeight)) package.window.marginHeight = undefined;
    if (([null, true]).includes(package.window.resizable)) package.window.resizable = undefined;
    if (!package.window.fullScreen) package.window.fullScreen = undefined;
    if (([null, true]).includes(package.window.fillWindow)) package.window.fillWindow = undefined;

    await FS.writeFile("output/package.json", JSON.stringify(package));

    const iconFiles = await FS.readdir("input/icon", { recursive : true });

    for (let i = 0; i < iconFiles.length; i++)
    {
        if (!(await FS.stat(`input/icon/${iconFiles[i]}`)).isDirectory()) await DupeFile(iconFiles[i], "icon", "", "\\");
    }

    console.log("Compressing datas...");

    const dataFiles = (await FS.readdir("input/data", { recursive : true })).filter(item => item.endsWith(".json"));

    const libs = ["BlankEngine.Core"];
    const scripts = [];
    const shaders = [];

    for (let i = 0; i < dataFiles.length; i++)
    {
        const data = JSON.parse(await FS.readFile(`input/data/${dataFiles[i]}`, "utf8"));

        if (dataFiles[i] === "build.json")
        {
            libs.push(...data.libs);
            scripts.push(...data.scripts);
            shaders.push(...data.shaders);
        }

        let path = dataFiles[i].split("\\");
        path.pop();
        path = `output/data${path.length > 0 ? "/" : ""}${path.join("/")}`;

        if (!SyncFS.existsSync(path)) await FS.mkdir(path, { recursive : true });

        await FS.writeFile(`output/data/${dataFiles[i]}`, JSON.stringify(data));
    }

    console.log("Compressing libraries...");

    for (let i = 0; i < libs.length; i++) await PassLib(libs[i]);

    console.log("Compressing scripts...");

    for (let i = 0; i < scripts.length; i++)
    {
        const script = (typeof scripts[i] === "string") ? scripts[i] : scripts[i].src;

        await DupeFile(script, "js", ".js", "/");
    }

    for (let i = 0; i < shaders.length; i++) await DupeFile(shaders[i], "shaders", ".glsl", "/");

    console.log("Adding resources...");

    const imgFiles = await FS.readdir("input/img", { recursive : true });

    for (let i = 0; i < imgFiles.length; i++)
    {
        if (!(await FS.stat(`input/img/${imgFiles[i]}`)).isDirectory()) await DupeFile(imgFiles[i], "img", "", "\\");
    }

    console.log("Done!");
}

async function PassLib (lib)
{
    const input = `input/js/libs/${lib}`;
    const output = `output/js/libs/${lib}`;
    const data = JSON.parse(await FS.readFile(`${input}/package.json`, "utf8"));

    console.log(`Library: ${data.name}`);

    let mainScript = "";

    for (let i = 0; i < data.scripts.length; i++)
    {
        const script = await FS.readFile(`${input}/${data.scripts[i]}.js`, "utf8");

        mainScript += await Minify(script);
    }

    data.scripts = ["main"];

    await FS.mkdir(output, { recursive : true });

    await FS.writeFile(`${output}/main.js`, mainScript);
    await FS.writeFile(`${output}/package.json`, JSON.stringify(data));
}

async function DupeFile (file, dir, extension, splitter)
{
    let path = file.split(splitter);
    path.pop();
    path = `output/${dir}${path.length > 0 ? "/" : ""}${path.join("/")}`;

    if (!SyncFS.existsSync(path)) await FS.mkdir(path, { recursive : true });

    await FS.copyFile(`input/${dir}/${file}${extension}`, `output/${dir}/${file}${extension}`);
}

async function Minify (input)
{
    const output = await minify(input, minifyConfig);

    return output.code;
}


main();