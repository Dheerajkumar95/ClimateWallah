"""GHG emission factors (indicative, UK DEFRA/BEIS 2024 greenhouse gas
conversion factors, plus the India CEA grid factor for Scope 2 electricity).

All factors are kg CO2e per stated unit. These are provided for indicative
screening only — not a substitute for a verified GHG inventory.
"""

GHG_SCOPES = [
    {
        "id": "scope1",
        "name": "Scope 1 — Direct emissions",
        "description": "Fuels combusted on-site and owned vehicles/equipment, plus fugitive refrigerant losses.",
        "activities": [
            {"id": "natural_gas_kwh", "name": "Natural gas", "unit": "kWh", "factor": 0.18293},
            {"id": "diesel_l", "name": "Diesel (mobile/stationary)", "unit": "litres", "factor": 2.51233},
            {"id": "petrol_l", "name": "Petrol", "unit": "litres", "factor": 2.16802},
            {"id": "lpg_l", "name": "LPG", "unit": "litres", "factor": 1.55713},
            {"id": "fuel_oil_l", "name": "Fuel oil", "unit": "litres", "factor": 3.17493},
            {"id": "refrigerant_r410a_kg", "name": "Refrigerant R-410A (fugitive)", "unit": "kg", "factor": 2088.0},
            {"id": "refrigerant_r134a_kg", "name": "Refrigerant R-134a (fugitive)", "unit": "kg", "factor": 1430.0},
        ],
    },
    {
        "id": "scope2",
        "name": "Scope 2 — Purchased energy",
        "description": "Emissions from purchased electricity, heat and steam (location-based).",
        "activities": [
            {"id": "electricity_india_kwh", "name": "Electricity — India grid", "unit": "kWh", "factor": 0.71},
            {"id": "electricity_uk_kwh", "name": "Electricity — UK grid", "unit": "kWh", "factor": 0.20705},
            {"id": "district_heat_kwh", "name": "Purchased heat / steam", "unit": "kWh", "factor": 0.17073},
        ],
    },
    {
        "id": "scope3",
        "name": "Scope 3 — Value chain",
        "description": "Business travel, water, waste and other indirect value-chain emissions.",
        "activities": [
            {"id": "car_travel_km", "name": "Business travel — car (avg)", "unit": "km", "factor": 0.17048},
            {"id": "flight_short_pkm", "name": "Flight — short haul", "unit": "passenger-km", "factor": 0.15102},
            {"id": "flight_long_pkm", "name": "Flight — long haul", "unit": "passenger-km", "factor": 0.19085},
            {"id": "rail_pkm", "name": "Rail travel", "unit": "passenger-km", "factor": 0.03549},
            {"id": "water_supply_m3", "name": "Water supply", "unit": "m³", "factor": 0.177},
            {"id": "water_treatment_m3", "name": "Waste-water treatment", "unit": "m³", "factor": 0.272},
            {"id": "waste_landfill_t", "name": "Waste to landfill (mixed)", "unit": "tonnes", "factor": 458.9},
            {"id": "paper_t", "name": "Paper / board", "unit": "tonnes", "factor": 900.0},
        ],
    },
]

FACTOR_SOURCE = "UK DEFRA/BEIS 2024 conversion factors; India CEA grid factor for Scope 2 electricity. Indicative screening only."

_INDEX = {a["id"]: {**a, "scope": s["id"], "scope_name": s["name"]}
          for s in GHG_SCOPES for a in s["activities"]}


def get_activity(activity_id: str):
    return _INDEX.get(activity_id)
