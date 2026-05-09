"""
Anker Solix MQTT Poller für MagicMirror
Empfängt Echtzeit-Daten via MQTT von Solarbank A17C5 und Smart Meter A17X7.
Schreibt alle ~3-5 Sekunden eine JSON-Datei.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path

from aiohttp import ClientSession
from api import api
import common

# Rohne MQTT-Nachrichten zum Debuggen
raw_messages = {}

logging.basicConfig(level=logging.WARNING)
_LOGGER = logging.getLogger(__name__)

OUTPUT_FILE = Path("/home/pi/solix_mqtt_data.json")

# Seriennummern aus dem MQTT-Dump
SN_SOLARBANK = ""
SN_SMARTMETER = ""


def write_output(data: dict):
    """Schreibt JSON-Datei atomar."""
    tmp = OUTPUT_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(OUTPUT_FILE)


def build_output(sb: dict, sm: dict) -> dict:
    """Berechnet alle 6 Zielwerte aus den MQTT-Rohdaten."""

    # Solarleistung
    solar_power = int(sb.get("photovoltaic_power") or 0)

    # Batterie: positiv = laden, negativ = entladen
    bat_signed = float(sb.get("battery_power_signed") or 0)
    bat_charging    = max(0, int(bat_signed))
    bat_discharging = max(0, int(-bat_signed))

    # Batterieladung %
    battery_pct = int(sb.get("battery_soc") or 0)

    # Einspeisung ins Haus (Solar + Bat-Entladen - Bat-Laden)
    einspeisung_w = solar_power + bat_discharging - bat_charging

    # Hausverbrauch aus Solarbank
    home_load = int(float(sb.get("home_demand") or 0))

    # Netz: getrennte Felder vom Smart Meter zusammenführen
    grid_to_home = int(sm.get("grid_to_home_power") or 0)
    pv_to_grid   = int(sm.get("pv_to_grid_power") or 0)
    grid_power   = grid_to_home - pv_to_grid  # positiv = Bezug, negativ = Einspeisung

    return {
        "solar_power_w":     solar_power,
        "bat_charging_w":    bat_charging,
        "bat_discharging_w": bat_discharging,
        "battery_pct":       battery_pct,
        "einspeisung_w":     einspeisung_w,
        "home_load_w":       home_load,
        "grid_power_w":      grid_power,
        "updated_at":        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "error":             None
    }


async def poll_loop():
    from api.mqtt_factory import SolixMqttDeviceFactory

    async with ClientSession() as session:
        myapi = api.AnkerSolixApi(
            common.user(),
            common.password(),
            common.country(),
            session,
            _LOGGER
        )

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Authentifiziere...")
        await myapi.update_sites()

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Starte MQTT-Session...")
        mqtt_session = await myapi.startMqttSession()

        if not mqtt_session:
            print("[FEHLER] MQTT-Session konnte nicht gestartet werden!")
            return

        # Topics und Trigger-Geräte als shared mutable sets (wie mqtt_monitor.py)
        topics = set()
        trigger_devices = set()

        for sn in [SN_SOLARBANK, SN_SMARTMETER]:
            device_dict = myapi.devices.get(sn, {})
            if not device_dict:
                print(f"[WARNUNG] Gerät {sn} nicht gefunden")
                continue

            if prefix := mqtt_session.get_topic_prefix(deviceDict=device_dict):
                topics.add(f"{prefix}#")
            if cmd_prefix := mqtt_session.get_topic_prefix(deviceDict=device_dict, publish=True):
                topics.add(f"{cmd_prefix}#")

            # Echtzeit-Trigger aktivieren
            trigger_devices.add(sn)

            # MQTT-Device-Instanz erstellen
            SolixMqttDeviceFactory(myapi, sn).create_device()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Gerät registriert: {sn}")

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Topics: {topics}")

        # Callback der nach jeder MQTT-Nachricht aufgerufen wird
        def on_message(session, topic, message, data, model, device_sn, extracted_values):
            try:
                mqtt_data = myapi.mqttsession.mqtt_data if myapi.mqttsession else {}
                sb_data = mqtt_data.get(SN_SOLARBANK, {})
                sm_data = mqtt_data.get(SN_SMARTMETER, {})

                if sb_data:
                    output = build_output(sb_data, sm_data)
                    write_output(output)
                    print(
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"Solar: {output['solar_power_w']}W | "
                        f"Bat↑: {output['bat_charging_w']}W "
                        f"↓: {output['bat_discharging_w']}W "
                        f"{output['battery_pct']}% | "
                        f"Einspeisung: {output['einspeisung_w']}W | "
                        f"Haus: {output['home_load_w']}W | "
                        f"Netz: {output['grid_power_w']}W"
                    )
            except Exception as e:
                print(f"[FEHLER in Callback] {e}")

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Starte message_poller...")

        # message_poller übernimmt Verbindung, Subscription und Loop
        await mqtt_session.message_poller(
            topics=topics,
            trigger_devices=trigger_devices,
            msg_callback=on_message,
            timeout=60,
        )
        

if __name__ == "__main__":
    try:
        asyncio.run(poll_loop())
    except KeyboardInterrupt:
        print("\nMQTT-Poller gestoppt.")
