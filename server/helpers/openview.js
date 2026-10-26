const File = require("../models/file");

const isLocked = (f) => !!(f.lock && f.lock.answerHash);

async function openView(f) {
    const out = { slug: f.slug, name: f.name, type: f.type, isFinal: f.isFinal, locked: false };
    if (f.type === "file") {
        out.document = f.document;
    } else {
        const kids = await File.find({ parent: f.slug }).sort("name");
        out.children = kids.map((k) => ({
            slug: k.slug, name: k.name, type: k.type, locked: isLocked(k)
        }));
    }
    return out;
}

function lockedView(f) {
    return {
        slug: f.slug, name: f.name, type: f.type, locked: true,
        lock: { prompt: f.lock.prompt, hint: f.lock.hint, hasHint: !!f.lock.hint }
    };
}

module.exports = { isLocked, openView, lockedView };