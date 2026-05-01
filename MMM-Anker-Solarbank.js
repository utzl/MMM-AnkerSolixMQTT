Module.register("MMM-Anker-Solarbank", {

    defaults: {
        updateInterval: 10000,
        email: "",
        password: ""
    },

    start: function () {
        this.dataValues = null;
        this.getData();
        this.scheduleUpdate();
    },

    scheduleUpdate: function () {
        setInterval(() => {
            this.getData();
        }, this.config.updateInterval);
    },

    getData: function () {
        this.sendSocketNotification("GET_DATA", this.config);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "DATA_RESULT") {
            this.dataValues = payload;
            this.updateDom();
        }
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "anker-container";

        if (!this.dataValues) {
            wrapper.innerHTML = "Lade Energiedaten...";
            return wrapper;
        }

        const d = this.dataValues;

        const gridDirection = d.gridPower >= 0 ? "Bezug" : "Einspeisung";
        const gridArrow = d.gridPower >= 0 ? "⬇️" : "⬆️";

        wrapper.innerHTML = `
            <div class="anker-title">⚡ Energie Dashboard</div>

            <div class="anker-grid">
                
                <div class="anker-card solar">
                    <div class="label">☀️ Solar</div>
                    <div class="value">${d.solarPower} W</div>
                    ${this.createBar(d.solarPower, 2000)}
                </div>

                <div class="anker-card battery">
                    <div class="label">🔋 Batterie</div>
                    <div class="value">${d.batteryPercent}%</div>
                    ${this.createBar(d.batteryPercent, 100)}
                    <div class="sub">${d.batteryChargePower} W</div>
                </div>

                <div class="anker-card house">
                    <div class="label">🏠 Haus</div>
                    <div class="value">${d.houseFeedIn} W</div>
                </div>

                <div class="anker-card load">
                    <div class="label">⚡ Verbrauch</div>
                    <div class="value">${d.consumption} W</div>
                </div>

                <div class="anker-card grid">
                    <div class="label">🌐 Netz</div>
                    <div class="value">${gridArrow} ${Math.abs(d.gridPower)} W</div>
                    <div class="sub">${gridDirection}</div>
                </div>

            </div>
        `;

        return wrapper;
    },

    createBar: function (value, max) {
        const percent = Math.min(100, (value / max) * 100);

        return `
            <div class="bar">
                <div class="fill" style="width:${percent}%"></div>
            </div>
        `;
    }

});