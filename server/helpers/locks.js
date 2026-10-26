const FileModel = require("../models/file");

// Slugs of every locked item. The run is finished when all of them are server-verified.
async function lockSlugs(File = FileModel) {
    const locks = await File.find({ "lock.answerHash": { $exists: true } }).select("slug");
    return locks.map((l) => l.slug);
}

module.exports = { lockSlugs };
