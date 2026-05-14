import { VariableTypes, Variable, guardsFromDmnmodeler } from './translationOfADA';

const STORAGE_KEY = 'diagram_variables';

class VariablePanel {
  variables: Variable[] = [];
  dmnModeler: any = null;
  private isUpdatingFromDmn = false;

  constructor() {
    this.variables = this.loadVariables();
    this.initializePanel();
  }

  setDmnModeler(dmnModeler: any): void {
    this.dmnModeler = dmnModeler;
  }

  loadVariables(): Variable[] {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Could not read saved variables:', error);
      return [];
    }
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

    const reloadBtn = document.getElementById('variable-reload');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.updateFromDMN());
    }

    this.renderVariables();
  }

  async updateFromDMN(): Promise<void> {
    if (!this.dmnModeler || this.isUpdatingFromDmn) return;

    this.isUpdatingFromDmn = true;

    try {
      // Save the current DMN state and re-import it. This forces the modeler
      // to register ALL decision tables into getViews(), not just the ones
      // that have been opened interactively at least once.
      const { xml } = await this.dmnModeler.saveXML({ format: true });
      await this.dmnModeler.importXML(xml);

      const variableNames = this.extractVariablesFromModeler();

      // Preserve existing value + type for variables that haven't changed.
      // Variables removed from the DMN are also removed from the panel.
      this.variables = variableNames.map(name => {
        const existing = this.variables.find(v => v.name === name);
        return existing ?? {
          name,
          value: '',
          type: VariableTypes.string,
        };
      });

      this.saveVariables();
      this.renderVariables();
    } catch (error) {
      console.warn('Could not reload variables from DMN:', error);
    } finally {
      this.isUpdatingFromDmn = false;
    }
  }

  extractVariablesFromModeler(): string[] {
    if (!this.dmnModeler) return [];

    try {
      const [, variableNameSet] = guardsFromDmnmodeler(this.dmnModeler);
      return Array.from(variableNameSet).sort();
    } catch (error) {
      console.warn('Could not extract variables from DMN modeler:', error);
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