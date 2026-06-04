Module.register("MMM-AnkerSolixMQTT", {

    defaults: {
        updateInterval: 5000,
        dataFile: "/home/pi/solix_mqtt_data.json",
        animationSpeed: 0,
    },

    getTranslations() {
        return {
            de: "translations/de.json",
            en: "translations/en.json",
            fr: "translations/fr.json",
            nl: "translations/nl.json",
            es: "translations/es.json",
        };
    },

    start() {
        this.solixData = null;
        this.scheduleUpdate();
    },

    scheduleUpdate() {
        this.sendSocketNotification("FETCH_SOLIX_DATA", {
            dataFile: this.config.dataFile
        });
        setInterval(() => {
            this.sendSocketNotification("FETCH_SOLIX_DATA", {
                dataFile: this.config.dataFile
            });
        }, this.config.updateInterval);
    },

    socketNotificationReceived(notification, payload) {
        if (notification === "SOLIX_DATA") {
            this.solixData = payload;
            this.updateDom(this.config.animationSpeed);
        }
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "MMM-AnkerSolix";

        if (!this.solixData) {
            wrapper.innerHTML = `<div class='solix-header'>${this.translate("LOADING")}</div>`;
            return wrapper;
        }

        if (this.solixData.error) {
            wrapper.innerHTML = `<div class='solix-header'>⚠ ${this.translate("ERROR")}: ${this.solixData.error}</div>`;
            return wrapper;
        }

        const d = this.solixData;

        // Netz: positiv = Bezug (rot), negativ = Einspeisung (grün)
        const gridAbs   = Math.abs(d.grid_power_w);
        const gridColor = d.grid_power_w > 0 ? "red" : (d.grid_power_w < 0 ? "green" : "");
        const gridSign  = d.grid_power_w > 0 ? "+" : (d.grid_power_w < 0 ? "−" : "");
        const gridLabel = d.grid_power_w > 0
            ? this.translate("GRID_IMPORT")
            : (d.grid_power_w < 0 ? this.translate("GRID_EXPORT") : "");

        // Batterieladung: 0–100%
        const batPct = Math.min(100, Math.max(0, d.battery_pct));

        const grid = document.createElement("div");
        grid.className = "solix-grid";

        // ── Zeile 1 links: Solar ──────────────────────────
        const cardSolar = document.createElement("div");
        cardSolar.className = "solix-card";
        cardSolar.style.cssText = "grid-column: 1 / 2; grid-row: 1 / 2;";

        // Batterie
        const cardBat = document.createElement("div");
        cardBat.className = "solix-card";
        cardBat.innerHTML = `
            <div class="solix-card-label">${this.translate("BATTERY")}</div>
            <div class="solix-card-value blue">${batPct} %</div>
            <div class="solix-bat-row">
                <div class="solix-bat-item">${this.translate("BAT_CHARGE")} ${d.bat_charging_w} W</div>
                <div class="solix-bat-item">${this.translate("BAT_DISCHARGE")} ${d.bat_discharging_w} W</div>
            </div>
        `;

        // Hausverbrauch
        const cardHome = document.createElement("div");
        cardHome.className = "solix-card";
        cardHome.style.cssText = "grid-column: 3 / 4; grid-row: 1 / 2;";

        // ── Zeile 2 ──────────────────────────────────────

        // Einspeisung ins Haus (span 2)
        const cardEinspeisung = document.createElement("div");
        cardEinspeisung.className = "solix-card span2";
        cardEinspeisung.style.cssText = "grid-column: 1 / 2; grid-row: 2 / 3;";

        // Netz
        const cardGrid = document.createElement("div");
        cardGrid.className = "solix-card";
        cardGrid.style.cssText = "grid-column: 3 / 4; grid-row: 2 / 3;";

        grid.appendChild(cardSolar);
        grid.appendChild(cardBat);
        grid.appendChild(cardHome);
        grid.appendChild(cardEinspeisung);
        grid.appendChild(cardGrid);

        // Zeitstempel
        const footer = document.createElement("div");
        footer.className = "solix-footer";
        footer.textContent = `${this.translate("UPDATED")}: ${d.updated_at}`;

        wrapper.appendChild(grid);
        wrapper.appendChild(footer);
        return wrapper;
    },

    getStyles() {
        return ["MMM-AnkerSolixMQTT.css"];
    }
});
