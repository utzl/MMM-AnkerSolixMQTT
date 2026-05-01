const NodeHelper = require("node_helper");
const axios = require("axios");

module.exports = NodeHelper.create({

    start: function () {
        console.log("MMM-Anker-Solarbank helper gestartet...");
        this.token = null;
        this.siteId = null;
    },

    socketNotificationReceived: async function (notification, payload) {
        if (notification === "GET_DATA") {
            await this.ensureLogin(payload);
            await this.getEnergyData(payload);
        }
    },

    async ensureLogin(config) {
        if (this.token) return;

        try {
            const response = await axios.post(
                "https://ankerpower-api-eu.anker.com/passport/login",
                {
                    email: config.email,
                    password: config.password
                },
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

            this.token = response.data.data.token;
            console.log("Login erfolgreich");

            await this.getSiteId();

        } catch (err) {
            console.error("Login fehlgeschlagen:", err.message);
        }
    },

    async getSiteId() {
        try {
            const res = await axios.get(
                "https://ankerpower-api-eu.anker.com/power_service/v1/site/get_site_list",
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            this.siteId = res.data.data.site_list[0].site_id;
            console.log("Site ID:", this.siteId);

        } catch (err) {
            console.error("Fehler beim Laden der Site-ID:", err.message);
        }
    },

    async getEnergyData(config) {
        if (!this.siteId) return;

        try {
            const res = await axios.post(
                "https://ankerpower-api-eu.anker.com/power_service/v1/site/get_site_homepage",
                {
                    site_id: this.siteId
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const data = res.data.data;

            // ⚠️ Mapping basiert auf typischer API-Struktur
            const result = {
                solarPower: parseFloat(data.solar_power || 0),
                batteryChargePower: parseFloat(data.battery_power || 0),
                batteryPercent: parseFloat(data.battery_soc || 0),
                houseFeedIn: parseFloat(data.home_power || 0),
                consumption: parseFloat(data.load_power || 0),
                gridPower: parseFloat(data.grid_power || 0)
            };

            this.sendSocketNotification("DATA_RESULT", result);

        } catch (err) {
            console.error("Fehler beim Abrufen der Energiedaten:", err.message);
        }
    }

});