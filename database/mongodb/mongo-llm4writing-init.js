db.createUser({
    user: "llmwriting",
    pwd: "writingpwd",
    roles: [{
        role: "readWrite",
        db: "ailog"
    }]
});
