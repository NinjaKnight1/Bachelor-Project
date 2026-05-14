import { VariableTypes, Variable } from './translationOfFeel';

const STORAGE_KEY = 'diagram_variables';

class VariablePanel {
  variables: Variable[] = [];
  dmnModeler: any = null;

  constructor() {
    this.variables = this.loadVariables();
    this.initializePanel();
  }

  setDmnModeler(dmnModeler: any): void {
    this.dmnModeler = dmnModeler;
  }

  loadVariables(): Variable[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  saveVariables(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.variables));
  }

  initializePanel(): void {
    const toggleBtn = document.getElementById('variable-toggle');
    const content = document.getElementById('variable-content');
    
    if (toggleBtn && content) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = content.classList.toggle('hidden');
        toggleBtn.textContent = isHidden ? 'Variables ▶' : 'Variables ▼';
        toggleBtn.classList.toggle('collapsed', isHidden);
      });
    }

    this.renderVariables();
  }

  async updateFromDMN(): Promise<void> {
    const dmnVariables = await this.extractVariablesFromDMN();
    
    // Keep existing variable data for matching names
    const updatedVariables: Variable[] = dmnVariables.map(name => {
      const existing = this.variables.find(v => v.name === name);
      return existing || {
        name: name,
        value: '',
        type: 'text' as VariableTypes
      };
    });

    this.variables = updatedVariables;
    this.saveVariables();
    this.renderVariables();
  }

  async extractVariablesFromDMN(): Promise<string[]> {
    if (!this.dmnModeler) {
      return [];
    }

    try {
      // Get the XML from the modeler
      const { xml } = await this.dmnModeler.saveXML({ format: true });
      return this.extractVariablesFromXML(xml);
    } catch (error) {
      console.warn('Could not extract variables from DMN:', error);
      return [];
    }
  }

  extractVariablesFromXML(xml: string): string[] {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');

      const variables = new Set<string>();
      
      // Get all input elements from decision tables
      const inputs = doc.querySelectorAll('input');
      inputs.forEach(input => {
        // Try to get label/name
        const label = input.getAttribute('label') || input.getAttribute('name');
        if (label) {
          variables.add(label);
          return;
        }
        
        // Try to get from text content
        const text = input.querySelector('text');
        if (text && text.textContent && text.textContent.trim()) {
          variables.add(text.textContent.trim());
        }
      });

      return Array.from(variables).sort();
    } catch (error) {
      console.warn('Could not parse DMN XML:', error);
      return [];
    }
  }

  renderVariables(): void {
    const listContainer = document.getElementById('variables-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (this.variables.length === 0) {
      listContainer.innerHTML = '<p style="color: #999; font-size: 12px; margin: 0;">No variables from DMN</p>';
      return;
    }

    this.variables.forEach((variable, index) => {
      const varDiv = document.createElement('div');
      varDiv.className = 'variable-item';

      const nameLabel = document.createElement('label');
      nameLabel.textContent = variable.name;

      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.placeholder = 'value';
      valueInput.value = variable.value;
      valueInput.addEventListener('change', () => {
        this.updateVariable(index, 'value', valueInput.value);
      });

      const typeSelect = document.createElement('select');
      const options = Object.values(VariableTypes).map(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === variable.type) opt.selected = true;
        return opt;
      });
      typeSelect.append(...options);
      typeSelect.addEventListener('change', () => {
        this.updateVariable(index, 'type', typeSelect.value as VariableTypes);
      });

      varDiv.append(nameLabel, valueInput, typeSelect);
      listContainer.appendChild(varDiv);
    });
  }

  updateVariable(index: number, field: keyof Variable, value: any): void {
    this.variables[index][field] = value;
    this.saveVariables();
  }

  getVariables(): Variable[] {
    return this.variables;
  }

  updateFromPrompt(variables: Variable[]): void {
    this.variables = variables;
    this.saveVariables();
    this.renderVariables();
  }
}

export const variablePanel = new VariablePanel();
