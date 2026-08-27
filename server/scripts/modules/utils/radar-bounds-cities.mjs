import createToken from './hmac.mjs';
import { haversineDistance } from './calc.mjs';

const corsAnywhereKnownSources = [
	'/wikidata',
];

const limit = 7;

export default class RadarBoundsCities {
	static internalConstructBoundingBoxQuery(cornerWestLat, cornerWestLng, cornerEastLat, cornerEastLng) {
		const baseUrl = 'https://query.wikidata.org/sparql?query=';

		const pointCornerWest = `Point(${cornerWestLng} ${cornerWestLat})`;
		const pointCornerEast = `Point(${cornerEastLng} ${cornerEastLat})`;
		const queryLimit = 50;

		const query = `
			SELECT ?item ?itemLabel ?coord ?population WHERE {
				?item wdt:P31 wd:Q515 .
				?item wdt:P1082 ?population .
				FILTER(?population > 50000)
				?item wdt:P625 ?coord .
				SERVICE wikibase:box {
					?item wdt:P625 ?location .
					bd:serviceParam wikibase:cornerWest "${pointCornerWest}"^^geo:wktLiteral .
					bd:serviceParam wikibase:cornerEast "${pointCornerEast}"^^geo:wktLiteral .
				}
				SERVICE wikibase:label {
					bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" .
				}
			}
			ORDER BY DESC(?population)
			LIMIT ${queryLimit}
		`
			.replace(/\s+/g, ' ')
			.trim();

		return baseUrl + encodeURIComponent(query);
	}

	static async getBoundingBoxCities(primaryLat, primaryLon, cornerWestLat, cornerWestLng, cornerEastLat, cornerEastLng, minimumPrimaryDistance, minimumCitySpacing) {
		const finalResult = new Set();

		const defaultHeaders = new Headers({
			Accept: 'application/json',
			'User-Agent': 'ws4kp-international/1.0 (https://mwood77.github.io/ws4kp-international)',
			Origin: 'https://mwood77.github.io',
			'Access-Control-Allow-Origin': '*',
			'x-ws4kp': await createToken(),
		});

		const corsAnywhere = corsAnywhereKnownSources[Math.floor(Math.random() * corsAnywhereKnownSources.length)];
		const wikidataUrl = RadarBoundsCities.internalConstructBoundingBoxQuery(
			cornerWestLat,
			cornerWestLng,
			cornerEastLat,
			cornerEastLng,
		);

		const proxiedUrl = `${corsAnywhere}?url=${encodeURIComponent(wikidataUrl)}`;

		return fetch(proxiedUrl, { headers: defaultHeaders })
			.then((res) => res.json())
			.then((sparqlData) => {
				const results = sparqlData.results && sparqlData.results.bindings;
				if (results) {
					const cityNameContainer = [];

					results.forEach((item) => {
						const cityObject = {};

						if (item.itemLabel && item.itemLabel.value) {
							cityObject.city = item.itemLabel.value;
						}

						if (item.coord && item.coord.value) {
							// Wikidata coordinates are in the format "Point(longitude latitude)"
							// ex. "Point(10.738888888 59.913333333)"
							const wikidataCoords = item.coord.value.replace('Point(', '').replace(')', '').split(' ');
							const [lon, lat] = wikidataCoords;
							cityObject.lat = lat;
							cityObject.lon = lon;
						}

						// Wikedata API can return duplicate results with different pop objects,
						// and we don't care about different pop values. So we discard duplicates
						if (cityObject.city && !cityNameContainer.includes(cityObject.city)) {
							cityNameContainer.push(cityObject.city);
							finalResult.add(cityObject);
						}
					});
				}

				const candidates = Array.from(finalResult);

				const selected = [];

				for (const city of candidates) {
					const distanceFromPrimary = haversineDistance(
						primaryLat,
						primaryLon,
						parseFloat(city.lat),
						parseFloat(city.lon),
					);

					if (distanceFromPrimary < minimumPrimaryDistance) {
						continue;
					}

					const tooCloseToSelected = selected.some((selectedCity) => {
						const distance = haversineDistance(
							parseFloat(selectedCity.lat),
							parseFloat(selectedCity.lon),
							parseFloat(city.lat),
							parseFloat(city.lon),
						);

						return distance < minimumCitySpacing;
					});

					if (!tooCloseToSelected) {
						selected.push(city);
					}

					if (selected.length >= limit) {
						break;
					}
				}

				return Array.from(selected);
			});
	}

	static async getWeatherForCity(lat, lon) {
		const openMeteoAdditionalForecastParameters = '&hourly=temperature_2m,weather_code&forecast_days=1&timezone=auto';
		return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${openMeteoAdditionalForecastParameters}`)
			.then((res) => res.json())
			.then((response) => response.hourly);
	}
}
