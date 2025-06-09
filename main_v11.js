const map = L.map('map');
const limitesVictoria = [
  [-38.2355, -72.3375], // suroeste
  [-38.2185, -72.3125]  // noreste
];
map.fitBounds(limitesVictoria, { padding: [10, 10] });

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

function getCustomIcon(category) {
    const iconUrl = `icons/${category}.png`;
    return L.divIcon({
        className: '',
        html: `<div class="marcador-categoria icon-hover"><img src="${iconUrl}" alt="${category}"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
    });
}

function interpretarHorario(str) {
    if (!str) return '';
    const horas = str.match(/\d{1,2}:\d{2}/g);
    if (!horas || horas.length < 1) return "Otro";
    const horaInicio = parseInt(horas[0].split(":"[0]));
    const horaFin = horas[1] ? parseInt(horas[1].split(":"[0])) : horaInicio;
    const trabajaManana = horaInicio < 12;
    const trabajaTarde = horaFin >= 12;
    if (trabajaManana && trabajaTarde) return "Todo el día";
    if (trabajaManana) return "Mañana";
    if (trabajaTarde) return "Tarde";
    return "Otro";
}

let currentCategory = '';
let currentPublico = '';
let currentHorario = '';
let searchText = '';
let serviciosGeoJSON;
let serviciosLayer;


function filterAndRender() {
    // Filtrar servicios según criterios activos
    const filtrados = serviciosGeoJSON.features.filter(f => {
        const props = f.properties;

        const categoriaCoincide = !currentCategory || props.category === currentCategory;
        const publicoCoincide = !currentPublico || props.publico === currentPublico;
        const horarioInterpretado = interpretarHorario(props.horario);
        const horarioCoincide = !currentHorario || horarioInterpretado === currentHorario;
        const textoCoincide = !searchText || (props.nombre && props.nombre.toLowerCase().includes(searchText));

        return categoriaCoincide && publicoCoincide && horarioCoincide && textoCoincide;
    });

    // Agrupar servicios por dirección
    const agrupados = {};
    filtrados.forEach(f => {
        const dir = f.properties.direccion || "SIN_DIRECCION";
        if (!agrupados[dir]) agrupados[dir] = [];
        agrupados[dir].push(f);
    });

    // Remover capa anterior para refrescar el mapa
    if (serviciosLayer) map.removeLayer(serviciosLayer);

    serviciosLayer = L.layerGroup();

    // Crear marcadores agrupados en el mapa
    Object.values(agrupados).forEach(servicios => {
        const coord = servicios[0].geometry.coordinates;
        const latlng = [coord[1], coord[0]];
        const categoriaBase = servicios[0].properties.category;

        const marker = L.marker(latlng, {
            icon: getCustomIcon(categoriaBase)
        });

        marker.bindPopup("");
        marker.bindTooltip(servicios.length > 1 ? `${servicios.length} servicios` : servicios[0].properties.nombre, {direction: "top", offset: [0, -20], opacity: 0.9});

        // Definir contenido popup con scroll y acordeones
        marker.on("click", function () {
            map.setView(latlng, 15, { animate: true });
            this._icon.classList.add("marcador-bounce");
            setTimeout(() => this._icon.classList.remove("marcador-bounce"), 300);
            let htmlPopup = "";
            if (servicios.length > 1) {
                // Múltiples servicios en la misma dirección
                htmlPopup = servicios.map(feature => {
                    const conteoMultiple = incrementVisualCount(feature.properties.id || feature.properties.nombre);
                    return `
                    <div class="popup-content" style="margin-bottom: 10px; border-bottom: 1px solid #ccc;">
                        <div class="popup-title">${feature.properties.nombre}</div>
                        <div class="popup-desc">${feature.properties.descripcion || ''}</div>
                        <div class="popup-visitas">👁️ Visualizado ${conteoMultiple} veces en este navegador</div>
                        <button class="accordion" onclick="toggleSection(this)">Responsable</button>
                        <div class="panel">${feature.properties.institucion || 'No informado'}</div>
                        <button class="accordion" onclick="toggleSection(this)">Requisitos</button>
                        <div class="panel">${feature.properties.requisitos || 'No informado'}</div>
                        <button class="accordion" onclick="toggleSection(this)">Horario y contacto</button>
                        <div class="panel">${feature.properties.horario || 'No informado'}<br>${feature.properties.contacto || ''}</div>
                        <button class="accordion" onclick="toggleSection(this)">Observaciones</button>
                        <div class="panel">${feature.properties.observaciones || 'Sin observaciones'}</div>
                        ${feature.properties.ficha_url ? `<a class="popup-btn" href="${feature.properties.ficha_url}" target="_blank">📄 Imprimir ficha</a>` : ''}
                        <a class="popup-btn secondary" target="_blank" href="${'https://docs.google.com/forms/d/e/1FAIpQLSebKztRtycGKZZLfl-iliTa1Ndk4ttFfXtpMFbcnHwCbpenaQ/viewform?usp=pp_url&entry.1993333610=' + encodeURIComponent(feature.properties.nombre)}">🛠️ Corregir este servicio</a>
                    </div>
                    `;
                }).join('');
            } else {
                // Servicio único en la dirección
                const f = servicios[0];
                const conteoIndividual = incrementVisualCount(f.properties.id || f.properties.nombre);
                htmlPopup = `
                    <div class="popup-content">
                        <div class="popup-title">${f.properties.nombre}</div>
                        <div class="popup-desc">${f.properties.descripcion || ''}</div>
                        <div class="popup-visitas">👁️ Visualizado ${conteoIndividual} veces en este navegador</div>
                        <button class="accordion" onclick="toggleSection(this)">Responsable</button>
                        <div class="panel">${f.properties.institucion || 'No informado'}</div>
                        <button class="accordion" onclick="toggleSection(this)">Requisitos</button>
                        <div class="panel">${f.properties.requisitos || 'No informado'}</div>
                        <button class="accordion" onclick="toggleSection(this)">Horario y contacto</button>
                        <div class="panel">${f.properties.horario || 'No informado'}<br>${f.properties.contacto || ''}</div>
                        <button class="accordion" onclick="toggleSection(this)">Observaciones</button>
                        <div class="panel">${f.properties.observaciones || 'Sin observaciones'}</div>
                        ${f.properties.ficha_url ? `<a class="popup-btn" href="${f.properties.ficha_url}" target="_blank">📄 Imprimir ficha</a>` : ''}
                        <a class="popup-btn secondary" target="_blank" href="${'https://docs.google.com/forms/d/e/1FAIpQLSebKztRtycGKZZLfl-iliTa1Ndk4ttFfXtpMFbcnHwCbpenaQ/viewform?usp=pp_url&entry.1993333610=' + encodeURIComponent(f.properties.nombre)}">🛠️ Corregir este servicio</a>
                    </div>
                `;
            }

            this.setPopupContent(htmlPopup);
            this.openPopup();
        });

        serviciosLayer.addLayer(marker);
    });

    serviciosLayer.addTo(map);
}


function incrementVisualCount(id) {
    const data = JSON.parse(localStorage.getItem("visualizaciones_servicios") || "{}");
    data[id] = (data[id] || 0) + 1;
    localStorage.setItem("visualizaciones_servicios", JSON.stringify(data));
    return data[id];
}

function clearFilters() {
    currentCategory = '';
    currentPublico = '';
    currentHorario = '';
    searchText = '';
    const input = document.getElementById('searchBox');
    if (input) input.value = '';
    filterAndRender();
}

function updateSearch(value) {
    searchText = value.toLowerCase();
    filterAndRender();
}

function setFilter(type, value) {
    if (type === 'category') currentCategory = value;
    if (type === 'publico') currentPublico = value;
    if (type === 'horario') currentHorario = value;
    filterAndRender();
}

function toggleSection(button) {
    const panel = button.nextElementSibling;
    panel.style.display = (panel.style.display === "block") ? "none" : "block";
}

fetch('Catálogo Beneficios y Servicios ID.geojson')
    .then(res => res.json())
    .then(data => {
        serviciosGeoJSON = data;
        filterAndRender();
    })
    .catch(err => {
        alert("No se pudo cargar el catálogo.");
        console.error(err);
    });