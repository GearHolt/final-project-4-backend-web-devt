function readSaveBody(body) {
    const { solved, readDocuments, location = "root" } = body || {};
    if (!Array.isArray(solved) || !solved.every((s) => typeof s === "string")) {
        return { error: "solved must be a list of slugs" };
    }
    if (readDocuments !== undefined &&
        (!Array.isArray(readDocuments) || !readDocuments.every((s) => typeof s === "string"))) {
        return { error: "readDocuments must be a list of slugs" };
    }
    return { value: { solved, readDocuments, location } };
}

function buildSaveChange({ list, location, docs, now = new Date() }) {
    const change = { $set: { solved: list, location, updatedAt: now } };
    if (docs) change.$set.hintsSeen = docs;
    return change;
}

module.exports = { readSaveBody, buildSaveChange };
