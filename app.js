const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOBbHJ9exRvwmEluGfT5WfOeXFKfCYxrK8pYofSDYcKlclWvefqOZQA1zwGkpvR7Uszw/exec";

class InventoryForm {
  constructor() {
    this.ruchersCache = [];
    this.stockCache = {};
    this.pendingOperations = [];
    this.init();
  }

  async init() {
    this.setupTabs();
    this.setupForms();
    this.setupStatusMonitor();
    this.registerServiceWorker();
    await this.loadRuchers();
  }

  setupTabs() {
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  }

  setupForms() {
    document.getElementById('formTransfer').addEventListener('submit', (e) => this.handleTransfer(e));
    document.getElementById('formArrivee').addEventListener('submit', (e) => this.handleArrivee(e));
    document.getElementById('formDepart').addEventListener('submit', (e) => this.handleDepart(e));
    document.getElementById('formComposition').addEventListener('submit', (e) => this.handleComposition(e));
    document.getElementById('formCreateRucher').addEventListener('submit', (e) => this.handleCreateRucher(e));

    // Show cause field for depart
    document.getElementById('departMotif').addEventListener('change', (e) => {
      const causeGroup = document.getElementById('causeGroup');
      if (e.target.value === 'mortalité' || e.target.value === 'vol') {
        causeGroup.style.display = 'block';
        causeGroup.querySelector('textarea').required = true;
      } else {
        causeGroup.style.display = 'none';
        causeGroup.querySelector('textarea').required = false;
      }
    });
  }

  setupStatusMonitor() {
    window.addEventListener('online', () => this.updateStatus());
    window.addEventListener('offline', () => this.updateStatus());
    this.updateStatus();
  }

  updateStatus() {
    const online = navigator.onLine;
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    
    if (online) {
      dot.className = 'status-dot online';
      text.textContent = '🟢 En ligne';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = '🔴 Mode hors-ligne';
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
    }
  }

  async loadRuchers() {
    try {
      const response = await fetch(APPS_SCRIPT_URL + '?action=ruchers');
      const ruchers = await response.json();
      this.ruchersCache = ruchers;
      this.populateSelects();
    } catch (error) {
      console.error('Erreur chargement ruchers:', error);
    }
  }

  populateSelects() {
    const selects = document.querySelectorAll('select[id$="Rucher"], select[id$="Source"], select[id$="Dest"], select[id$="Parent"]');
    
    selects.forEach(select => {
      const current = select.value;
      select.innerHTML = '<option value="">Sélectionnez...</option>';
      
      this.ruchersCache.forEach(r => {
        const option = document.createElement('option');
        option.value = r.nom;
        option.textContent = r.nom;
        select.appendChild(option);
      });
      
      if (current) select.value = current;
    });
  }

  async handleTransfer(e) {
    e.preventDefault();
    
    const operation = {
      type: 'transfer',
      horodateur: new Date().toISOString(),
      rucher: document.getElementById('transferSource').value,
      rucher_destination: document.getElementById('transferDest').value,
      quantite_ruches: parseInt(document.getElementById('transferRuches').value) || 0,
      quantite_ruchettes: parseInt(document.getElementById('transferRuchettes').value) || 0,
      quantite_hausses: parseInt(document.getElementById('transferHausses').value) || 0,
      justification: document.getElementById('transferJustif').value
    };

    if (operation.rucher === operation.rucher_destination) {
      this.showAlert('Le rucher destination doit être différent', 'error');
      return;
    }

    await this.submitOperation(operation);
  }

  async handleArrivee(e) {
    e.preventDefault();
    
    const operation = {
      type: 'arrivee',
      horodateur: new Date().toISOString(),
      rucher: document.getElementById('arriveeRucher').value,
      source: document.getElementById('arriveeSource').value,
      quantite_ruches: parseInt(document.getElementById('arriveeRuches').value) || 0,
      quantite_ruchettes: parseInt(document.getElementById('arriveeRuchettes').value) || 0,
      quantite_hausses: 0
    };

    await this.submitOperation(operation);
  }

  async handleDepart(e) {
    e.preventDefault();
    
    const motif = document.getElementById('departMotif').value;
    const cause = document.getElementById('departCause').value;

    if ((motif === 'mortalité' || motif === 'vol') && !cause.trim()) {
      this.showAlert('Cause obligatoire pour mortalité/vol', 'error');
      return;
    }

    const operation = {
      type: 'depart',
      horodateur: new Date().toISOString(),
      rucher: document.getElementById('departRucher').value,
      motif: motif,
      cause_details: cause,
      quantite_ruches: parseInt(document.getElementById('departRuches').value) || 0,
      quantite_ruchettes: parseInt(document.getElementById('departRuchettes').value) || 0,
      quantite_hausses: 0
    };

    await this.submitOperation(operation);
  }

  async handleComposition(e) {
    e.preventDefault();
    
    const operation = {
      type: 'composition',
      horodateur: new Date().toISOString(),
      rucher: document.getElementById('compRucher').value,
      commentaires: `${document.getElementById('compParam').value}: ${document.getElementById('compBefore').value} → ${document.getElementById('compAfter').value}`
    };

    await this.submitOperation(operation);
  }

  async handleCreateRucher(e) {
    e.preventDefault();
    
    const operation = {
      action: 'create_rucher',
      nom_rucher: document.getElementById('createName').value,
      localisation: document.getElementById('createLocalisation').value,
      proprietaire_nom: document.getElementById('createProp').value,
      proprietaire_email: document.getElementById('createEmail').value,
      proprietaire_tel: document.getElementById('createTel').value
    };

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(operation)
      });
      
      const result = await response.json();
      
      if (result.valid) {
        this.showAlert(`✓ Rucher "${operation.nom_rucher}" créé!`, 'success');
        document.getElementById('formCreateRucher').reset();
        await this.loadRuchers();
      } else {
        this.showAlert(result.errors[0] || 'Erreur création', 'error');
      }
    } catch (error) {
      this.showAlert('Erreur: ' + error.message, 'error');
    }
  }

  async submitOperation(operation) {
    if (!navigator.onLine) {
      this.savePending(operation);
      this.showAlert('⚠️ Sauvegardé localement (mode hors-ligne)', 'warning');
      return;
    }

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(operation)
      });
      
      const result = await response.json();
      
      if (result.valid) {
        this.showAlert('✓ Opération enregistrée', 'success');
        
        // Reset form
        const formId = operation.type === 'transfer' ? 'formTransfer' 
                     : operation.type === 'arrivee' ? 'formArrivee'
                     : operation.type === 'depart' ? 'formDepart'
                     : 'formComposition';
        document.getElementById(formId).reset();
      } else {
        this.showAlert(result.errors[0] || 'Erreur', 'error');
      }
    } catch (error) {
      this.savePending(operation);
      this.showAlert('⚠️ Sauvegardé pour sync', 'warning');
    }
  }

  savePending(operation) {
    this.pendingOperations.push(operation);
    localStorage.setItem('pendingOps', JSON.stringify(this.pendingOperations));
  }

  showAlert(message, type = 'info') {
    const alertsDiv = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert ${type} show`;
    alert.textContent = message;
    alertsDiv.appendChild(alert);

    setTimeout(() => {
      alert.remove();
    }, 5000);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  new InventoryForm();
});
