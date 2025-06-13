const map = L.map('map');

const limitesVictoria = [
  [-38.2355, -72.3375],
  [-38.2185, -72.3125]
];
const vistaIdeal = [
  [-38.24633032312945, -72.36317073313496],
  [-38.22511213722087, -72.30780973313497]
];
map.fitBounds(vistaIdeal, { padding: [10, 10] });

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
  if (!str || typeof str !== 'string') return 'Otro';
  const horas = str.match(/\d{1,2}:\d{2}/g);
  if (!horas || horas.length < 1) return 'Otro';
  const horaInicio = parseInt(horas[0].split(':')[0]);
  const horaFin = horas[1] ? parseInt(horas[1].split(':')[0]) : horaInicio;
  const trabajaManana = horaInicio < 12;
  const trabajaTarde = horaFin >= 12;
  if (trabajaManana && trabajaTarde) return 'Mañana y tarde';
  if (trabajaManana) return 'Mañana';
  if (trabajaTarde) return 'Tarde';
  return 'Otro';
}

let currentCategory = '';
let currentPublico = '';
let currentHorario = '';
let marcadorAbierto = null;



document.addEventListener('click', function (e) {
    const popup = document.getElementById('popup-flotante');
    const esMarcador = e.target.closest('.leaflet-marker-icon');
    const esPopup = e.target.closest('#popup-flotante');

    if (popup && popup.style.display === 'block' && !esMarcador && !esPopup) {
        cerrarPopupFlotante();
    }
});

let searchText = '';
let serviciosGeoJSON;
let serviciosLayer;

function filterAndRender() {
  if (!serviciosGeoJSON || !serviciosGeoJSON.features) {
    console.error('Error: serviciosGeoJSON no está definido o mal formateado');
    return;
  }

  const filtrados = serviciosGeoJSON.features.filter(f => {
    const props = f.properties || {};

    const cat = (props.category || '').toLowerCase().trim();
    const pub = (props["público"] || '').toLowerCase().trim();
    const hor = (props.horario || '').toLowerCase().trim();
    const nombre = (props.nombre || '').toLowerCase();

    const categoriaCoincide = !currentCategory || cat === currentCategory.toLowerCase().trim();
    const publicoCoincide = !currentPublico || pub === currentPublico.toLowerCase().trim();
    const horarioCoincide = !currentHorario || hor === currentHorario.toLowerCase().trim();
    const textoCoincide = !searchText || nombre.includes(searchText);

    return categoriaCoincide && publicoCoincide && horarioCoincide && textoCoincide;
  });

  // El resto de la función permanece igual
  const agrupados = {};
  filtrados.forEach(f => {
    const dir = (f.properties.direccion || "SIN_DIRECCION")
      .trim().toLowerCase()
      .replace(/[\s#]+/g, ' ')
      .replace(/\s+/g, ' ');
    if (!agrupados[dir]) agrupados[dir] = [];
    agrupados[dir].push(f);
  });

  if (serviciosLayer) map.removeLayer(serviciosLayer);
  serviciosLayer = L.layerGroup();

  Object.values(agrupados).forEach(servicios => {
    const coord = servicios[0].geometry.coordinates;
    const latlng = [coord[1], coord[0]];
    const categoriaBase = servicios[0].properties.category;

    const marker = L.marker(latlng, {
      icon: getCustomIcon(categoriaBase)
    });

    marker.bindTooltip(
      servicios.length > 1 ? `${servicios.length} servicios` : servicios[0].properties.nombre,
      { direction: "top", offset: [0, -20], opacity: 0.9 }
    );

    marker.on("click", function () {
      if (marcadorAbierto === this) {
        cerrarPopupFlotante();
        marcadorAbierto = null;
        return;
      }

      marcadorAbierto = this;

      const popup = document.getElementById('popup-flotante');
      popup.style.left = '50%';
      popup.style.top = '110px';
      popup.style.transform = 'translateX(-50%)';
      popup.style.display = 'block'

      let htmlPopup = '';
      if (servicios.length > 1) {
        htmlPopup = servicios.map(f => {
          const conteo = incrementVisualCount(f.properties.id || f.properties.nombre);
          return `
            <div class="popup-content" style="margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
              <div class="popup-title">${f.properties.nombre}</div>
              <div class="popup-desc">${f.properties.descripcion || ''}</div>
              <div class="popup-visitas">👁️ Visualizado ${conteo} veces</div>
              <button class="accordion" onclick="toggleSection(this)">Responsable</button>
              <div class="panel">${f.properties.institucion || 'No informado'}</div>
              <button class="accordion" onclick="toggleSection(this)">Requisitos</button>
              <div class="panel">${f.properties.requisitos || 'No informado'}</div>
              <button class="accordion" onclick="toggleSection(this)">Horario y contacto</button>
              <div class="panel">${f.properties.horario || 'No informado'}<br>${f.properties.contacto || ''}</div>
              <button class="accordion" onclick="toggleSection(this)">Observaciones</button>
              <div class="panel">${f.properties.observaciones || 'Sin observaciones'}</div>
              ${f.properties.ficha_url ? `<a class="popup-btn" href="${f.properties.ficha_url}" target="_blank">📄 Imprimir ficha</a>` : ''}
              <a class="popup-btn secondary" target="_blank" href="https://docs.google.com/forms/d/e/1FAIpQLSebKztRtycGKZZLfl-iliTa1Ndk4ttFfXtpMFbcnHwCbpenaQ/viewform?usp=pp_url&entry.1993333610=${encodeURIComponent(f.properties.nombre)}">🛠️ Corregir este servicio</a>
            </div>`;
        }).join('');
      } else {
        const f = servicios[0];
        const conteo = incrementVisualCount(f.properties.id || f.properties.nombre);
        htmlPopup = `
          <div class="popup-content">
            <div class="popup-title">${f.properties.nombre}</div>
            <div class="popup-desc">${f.properties.descripcion || ''}</div>
            <div class="popup-visitas">👁️ Visualizado ${conteo} veces</div>
            <button class="accordion" onclick="toggleSection(this)">Responsable</button>
            <div class="panel">${f.properties.institucion || 'No informado'}</div>
            <button class="accordion" onclick="toggleSection(this)">Requisitos</button>
            <div class="panel">${f.properties.requisitos || 'No informado'}</div>
            <button class="accordion" onclick="toggleSection(this)">Horario y contacto</button>
            <div class="panel">${f.properties.horario || 'No informado'}<br>${f.properties.contacto || ''}</div>
            <button class="accordion" onclick="toggleSection(this)">Observaciones</button>
            <div class="panel">${f.properties.observaciones || 'Sin observaciones'}</div>
            ${f.properties.ficha_url ? `<a class="popup-btn" href="${f.properties.ficha_url}" target="_blank">📄 Imprimir ficha</a>` : ''}
            <a class="popup-btn secondary" target="_blank" href="https://docs.google.com/forms/d/e/1FAIpQLSebKztRtycGKZZLfl-iliTa1Ndk4ttFfXtpMFbcnHwCbpenaQ/viewform?usp=pp_url&entry.1993333610=${encodeURIComponent(f.properties.nombre)}">🛠️ Corregir este servicio</a>
          </div>`;
      }

      popup.className = 'popup-flotante';
      if (servicios.length >= 3) {
        popup.classList.add('popup-largo');
      }
      popup.innerHTML = `<button class='cerrar-popup-icon' onclick='cerrarPopupFlotante()' title='Cerrar'>✖</button>` + htmlPopup;
    });

    serviciosLayer.addLayer(marker);
  });

  serviciosLayer.addTo(map);
}


function cerrarPopupFlotante() {
  const popup = document.getElementById('popup-flotante');
  popup.style.display = 'none';
  popupAbierto = false;
  marcadorAbierto = null;
}

function toggleSection(button) {
  const panel = button.nextElementSibling;
  panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
  button.classList.toggle('active');
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
  actualizarIconosLocales();
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

fetch('Catálogo Beneficios y Servicios ID.geojson')
  .then(res => res.json())
  .then(data => {
    serviciosGeoJSON = data;
    filterAndRender();
    actualizarIconosLocales();

  })
  .catch(err => {
    alert("No se pudo cargar el catálogo.");
    console.error(err);
  });



function actualizarIconosLocales() {
  document.querySelectorAll('.btn-icon.local-icon').forEach(span => {
    const valorOriginal = span.getAttribute('data-icon') || '';
    const key = valorOriginal
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[ñ]/g, "n")
      .replace(/[^a-z0-9]+/g, '-');
    span.style.backgroundImage = `url('icons/${key}.png')`;
  });
}
