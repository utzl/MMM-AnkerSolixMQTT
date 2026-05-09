const NodeHelper = require("node_helper");
const fs = require("fs");

module.exports = NodeHelper.create({

    socketNotificationReceived(notification, payload) {
        if (notification === "FETCH_SOLIX_DATA") {
            try {
                const raw = fs.readFileSync(payload.dataFile, "utf8");
                const data = JSON.parse(raw);
                this.sendSocketNotification("SOLIX_DATA", data);
            } catch (err) {
                this.sendSocketNotification("SOLIX_DATA", {
                    error: `Datei nicht lesbar: ${err.message}`
                });
            }
        }
    }
});
