const FS = require("fs/promises");
const SyncFS = require("fs");
const { minify } = require("terser");
const path = require("path");


const inputPath = path.normalize(process.argv[2] ?? "");
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
    if (process.argv[2] == null)
    {
        console.log("\x1b[1m\x1b[31m", `Please specify an input path\x1b[0m`);
        console.log("\x1b[36m", `node main.js \x1b[35m"<put-ur-damn-project-path-here>"\x1b[0m\n`);

        return;
    }

    console.log("\x1b[1m", `\nInput @ \x1b[35m"${inputPath}"`);

    console.log("\x1b[0m", "\nGetting output ready...");

    await FS.rm("output", { recursive : true, force : true });
    await FS.mkdir("output");

    console.log("Dumping cached data...");

    await FS.copyFile("cached/index.html", "output/index.html");
    await FS.copyFile("cached/cordova.js", "output/cordova.js");

    await FS.mkdir("output/js");

    const Application = await FS.readFile(`${inputPath}/js/Application.js`, "utf8");
    const Window = await FS.readFile(`${inputPath}/js/Window.js`, "utf8");
    const CrystalEngine = await FS.readFile(`${inputPath}/js/CrystalEngine.js`, "utf8");
    const mainScript = await FS.readFile(`${inputPath}/js/main.js`, "utf8");

    await FS.writeFile("output/js/main.js", `${await Minify(Application)}${await Minify(Window)}${await Minify(CrystalEngine)}${await Minify(mainScript)}`);

    const manifest = JSON.parse(await FS.readFile(`${inputPath}/manifest.json`, "utf8"));

    if (([null, "Untitled"]).includes(manifest.window.title)) manifest.window.title = undefined;
    if (([null, 250]).includes(manifest.window.width)) manifest.window.width = undefined;
    if (([null, 250]).includes(manifest.window.height)) manifest.window.height = undefined;
    if (([null, 0]).includes(manifest.window.windowWidth)) manifest.window.windowWidth = undefined;
    if (([null, 0]).includes(manifest.window.windowHeight)) manifest.window.windowHeight = undefined;
    if (([null, 0]).includes(manifest.window.marginWidth)) manifest.window.marginWidth = undefined;
    if (([null, 0]).includes(manifest.window.marginHeight)) manifest.window.marginHeight = undefined;
    if (([null, true]).includes(manifest.window.resizable)) manifest.window.resizable = undefined;
    if (!manifest.window.fullscreen) manifest.window.fullscreen = undefined;
    if (([null, true]).includes(manifest.window.fillWindow)) manifest.window.fillWindow = undefined;

    await FS.writeFile("output/manifest.json", JSON.stringify(manifest));

    const iconFiles = await FS.readdir(`${inputPath}/icon`, { recursive : true });

    for (let i = 0; i < iconFiles.length; i++)
    {
        if (!(await FS.stat(`${inputPath}/icon/${iconFiles[i]}`)).isDirectory()) await DupeFile(iconFiles[i], "icon", "", "\\");
    }

    console.log("Compressing data...");

    const dataFiles = (await FS.readdir(`${inputPath}/data`, { recursive : true }));

    const libs = ["Crystal.Core"];
    const scripts = [];
    const shaders = [
        "vertex",
        "fragment"
    ];

    for (let i = 0; i < dataFiles.length; i++)
    {
        if ((await FS.stat(`${inputPath}/data/${dataFiles[i]}`)).isDirectory()) continue;

        if (!dataFiles[i].endsWith(".json"))
        {
            await FS.copyFile(`${inputPath}/data/${dataFiles[i]}`, `output/data/${dataFiles[i]}`);

            continue;
        }

        const data = JSON.parse(await FS.readFile(`${inputPath}/data/${dataFiles[i]}`, "utf8"));

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

    console.log("\nCompressing libraries...");

    for (let i = 0; i < libs.length; i++) await PassLib(libs[i]);

    console.log("\nCompressing scripts...");

    for (let i = 0; i < scripts.length; i++)
    {
        const script = (typeof scripts[i] === "string") ? scripts[i] : scripts[i].src;

        await DupeFile(script, "js", ".js", "/");
    }

    for (let i = 0; i < shaders.length; i++) await DupeFile(shaders[i], "shaders", ".glsl", "/");

    console.log("Adding resources...");

    try
    {
        const imgFiles = await FS.readdir(`${inputPath}/img`, { recursive : true });

        for (let i = 0; i < imgFiles.length; i++)
        {
            if (!(await FS.stat(`${inputPath}/img/${imgFiles[i]}`)).isDirectory()) await DupeFile(imgFiles[i], "img", "", "\\");
        }
    }
    catch { }

    try
    {
        const audioFiles = await FS.readdir(`${inputPath}/audio`, { recursive : true });

        for (let i = 0; i < audioFiles.length; i++)
        {
            if (!(await FS.stat(`${inputPath}/audio/${audioFiles[i]}`)).isDirectory()) await DupeFile(audioFiles[i], "audio", "", "\\");
        }
    }
    catch { }


    console.log("\x1b[1m\x1b[32m", "\nDone!\n\x1b[0m");
}

async function PassLib (lib)
{
    const input = `${inputPath}/js/libs/${lib}`;
    const output = `output/js/libs/${lib}`;
    const data = JSON.parse(await FS.readFile(`${input}/manifest.json`, "utf8"));

    console.log(`    ${data.name} \x1b[36m${data.version ?? ""}\x1b[0m`);

    let mainScript = "";

    for (let i = 0; i < data.scripts.length; i++)
    {
        const script = await FS.readFile(`${input}/${data.scripts[i]}.js`, "utf8");

        mainScript += await Minify(script);
    }

    data.scripts = ["main"];

    await FS.mkdir(output, { recursive : true });

    await FS.writeFile(`${output}/main.js`, mainScript);
    await FS.writeFile(`${output}/manifest.json`, JSON.stringify(data));

    for (let i = 0; i < data.preserve?.length; i++) await FS.copyFile(`${input}/${data.preserve[i]}`, `${output}/${data.preserve[i]}`);
}

async function DupeFile (file, dir, extension, splitter)
{
    let path = file.split(splitter);
    path.pop();
    path = `output/${dir}${path.length > 0 ? "/" : ""}${path.join("/")}`;

    if (!SyncFS.existsSync(path)) await FS.mkdir(path, { recursive : true });

    await FS.copyFile(`${inputPath}/${dir}/${file}${extension}`, `output/${dir}/${file}${extension}`);
}

async function Minify (input)
{
    const output = await minify(input, minifyConfig);

    return output.code;
}


main();