Module.register("MMM-AnkerSolixMQTT", {

    defaults: {
        updateInterval: 60000,
        dataFile: "/home/pi/solix_data.json",
        animationSpeed: 0,
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
            wrapper.innerHTML = "<div class='solix-header'>Lade Solardaten...</div>";
            return wrapper;
        }

        if (this.solixData.error) {
            wrapper.innerHTML = `<div class='solix-header'>⚠ ${this.solixData.error}</div>`;
            return wrapper;
        }

        const d = this.solixData;

        // Netz: positiv = Bezug (rot), negativ = Einspeisung (grün)
        const gridAbs   = Math.abs(d.grid_power_w);
        const gridColor = d.grid_power_w > 0 ? "red" : (d.grid_power_w < 0 ? "green" : "");
        const gridSign  = d.grid_power_w > 0 ? "+" : (d.grid_power_w < 0 ? "−" : "");

        // Batterieladung: 0–100%
        const batPct = Math.min(100, Math.max(0, d.battery_pct));

        const grid = document.createElement("div");
        grid.className = "solix-grid";

        // ── Zeile 1 ──────────────────────────────────────

        // Solar
        const cardSolar = document.createElement("div");
        cardSolar.className = "solix-card";
        cardSolar.innerHTML = `
            <div class="solix-card-label">Solar</div>
            <div class="solix-card-value yellow">${d.solar_power_w} W</div>
        `;

        // Batterie
        const cardBat = document.createElement("div");
        cardBat.className = "solix-card";
        cardBat.innerHTML = `
            <div class="solix-card-label">Batterie</div>
            <div class="solix-card-value blue">${batPct} %</div>
            <div class="solix-bat-row">
                <div class="solix-bat-item">↑ ${d.bat_charging_w} W</div>
                <div class="solix-bat-item">↓ ${d.bat_discharging_w} W</div>
            </div>
        `;

        // Hausverbrauch
        const cardHome = document.createElement("div");
        cardHome.className = "solix-card";
        cardHome.innerHTML = `
            <div class="solix-card-label">Hausverbrauch</div>
            <div class="solix-card-value">${d.home_load_w} W</div>
        `;

        // ── Zeile 2 ──────────────────────────────────────

        // Einspeisung ins Haus (span 2)
        const cardEinspeisung = document.createElement("div");
        cardEinspeisung.className = "solix-card span2";
        cardEinspeisung.innerHTML = `
            <div class="solix-card-label">Einspeisung ins Haus</div>
            <div class="solix-card-value green">${d.einspeisung_w} W</div>
        `;

        // Netz
        const cardGrid = document.createElement("div");
        cardGrid.className = "solix-card";
        cardGrid.innerHTML = `
            <div class="solix-card-label">Netz</div>
            <div class="solix-card-value ${gridColor}">${gridSign}${gridAbs} W</div>
        `;

        grid.appendChild(cardSolar);
        grid.appendChild(cardBat);
        grid.appendChild(cardHome);
        grid.appendChild(cardEinspeisung);
        grid.appendChild(cardGrid);

        // Zeitstempel
        const footer = document.createElement("div");
        footer.className = "solix-footer";
        footer.textContent = `Aktualisiert: ${d.updated_at}`;

        wrapper.appendChild(grid);
        wrapper.appendChild(footer);
        return wrapper;
    },

    getStyles() {
        return ["MMM-AnkerSolixMQTT.css"];
    }
});
