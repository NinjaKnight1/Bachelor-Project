import { VariableTypes, Variable, DiagramDecision, decisionDiagramFromBpmnAndDmn } from './translationOfADA';

const STORAGE_KEY = 'diagram_variables';

class VariablePanel {
  variables: Variable[] = [];
  bpmnModeler: any = null;
  dmnModeler: any = null;
  private isUpdatingFromDmn = false;

  constructor() {
    this.variables = this.loadVariables();
    this.initializePanel();
  }

  setModelers(bpmnModeler: any, dmnModeler: any): void {
    this.bpmnModeler = bpmnModeler;
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
    if (!this.bpmnModeler || !this.dmnModeler) {
      console.warn('Could not reload variables from DMN: modelers are not ready yet');
      return;
    }

    if (this.isUpdatingFromDmn) {
      return;
    }

    this.isUpdatingFromDmn = true;

    // Show loading state on the reload button
    const reloadBtn = document.getElementById('variable-reload');
    const originalLabel = reloadBtn?.textContent ?? '';
    if (reloadBtn) {
      reloadBtn.textContent = 'Loading…';
      (reloadBtn as HTMLButtonElement).disabled = true;
    }

    try {
      // Mirror exactly what exportAndConvert does: save the full DMN XML and
      // re-import it so that every decision table view is registered in
      // getViews(), including tables that were never opened interactively.
      const { xml: dmnXml } = await this.dmnModeler.saveXML({ format: true });
      await this.dmnModeler.importXML(dmnXml);

      const diagramDecision: DiagramDecision = decisionDiagramFromBpmnAndDmn(
        this.bpmnModeler,
        this.dmnModeler,
        this.variables
      );

      // Build the new variable list, preserving existing value + type for
      // variables that haven't changed. Variables removed from the DMN are
      // dropped from the panel automatically.
      this.variables = diagramDecision.variableName.map(variable => {
        const existing = this.variables.find(v => v.name === variable.name);
        return {
          name: variable.name,
          value: existing?.value ?? '',
          type: existing?.type ?? VariableTypes.string,
        };
      });

      this.saveVariables();
      this.renderVariables();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Could not reload variables from DMN:', error);
      alert(`Could not reload variables from DMN: ${message}`);
    } finally {
      this.isUpdatingFromDmn = false;

      // Restore the reload button
      if (reloadBtn) {
        reloadBtn.textContent = originalLabel;
        (reloadBtn as HTMLButtonElement).disabled = false;
      }
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