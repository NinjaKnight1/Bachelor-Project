import { Variable, VariableTypes } from './translationOfFeel';


export async function promptVariables(variableNames: string[]): Promise<Variable[] | null> {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.style.border = 'none';
    dlg.style.padding = '0';
    dlg.innerHTML = `<form method="dialog" id="var-form" style="padding:1rem;min-width:420px;">
        <h3 style="margin-top:0">Define variables</h3>
        <div id="rows" style="display:flex;flex-direction:column;gap:.5rem;"></div>

        <footer style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem;">
          <button type="reset">Cancel</button>
          <button type="submit" id="okBtn">Save</button>
        </footer>
      </form>
      <style>
        dialog::backdrop { background:#0005; }
        input.error, select.error { outline:2px solid #c00; }
        .row { display:flex; align-items:center; gap:.5rem; }
        .row span  { width:120px; font-size:.9rem; }
        .row input { flex:1 1 150px; }
      </style>
    `;
    document.body.appendChild(dlg);

    const rows = dlg.querySelector<HTMLDivElement>('#rows')!;
    variableNames.forEach(vn => {
      // each value in the VariableTypes is made to an option 
      const options = Object.values(VariableTypes)
        .map(t => `<option value="${t}">${t}</option>`)   
        .join('');
      rows.insertAdjacentHTML(
        'beforeend',
        `<div class="row">
          <span>${vn}</span>
          <input placeholder="value for ${vn}" />
          <select>
            <option value="" disabled selected>type</option>
            ${options}  
          </select>
        </div>`
      );
  });

  const form = dlg.querySelector('form')!;
  form.addEventListener('reset', () => {
    dlg.close('cancel');
    dlg.remove();
    resolve(null);
  });

  form.addEventListener('submit', ev => {
    ev.preventDefault();

    const vars: Variable[] = [];
    let allFilled = true;

    rows.querySelectorAll<HTMLElement>('.row').forEach((row, idx) => {
      const input = row.querySelector<HTMLInputElement>('input')!;
      const select = row.querySelector<HTMLSelectElement>('select')!;
      input.classList.remove('error');
      select.classList.remove('error');

      if (input.value.trim() === '' || select.value === '') {
        allFilled = false;
        input.classList.add('error');
        select.classList.add('error');
      } else {
        vars.push({
          name: variableNames[idx],
          value: input.value.trim(),
          type: select.value as VariableTypes
        });
      }
    });

    if (!allFilled) {
      alert('Please fill every value and choose a type.');
      return;
    }

    dlg.close();
    dlg.remove();
    resolve(vars);
  });

  dlg.showModal();
});
}