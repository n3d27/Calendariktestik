const form = document.getElementById('birthdayForm');
const list = document.getElementById('birthdayList');

let birthdays = JSON.parse(localStorage.getItem('birthdays')) || [];

function render() {
  list.innerHTML = '';
  birthdays.forEach((b, i) => {
    const li = document.createElement('li');
    li.textContent = `${b.name} — ${b.date}`;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Удалить';
    delBtn.onclick = () => {
      birthdays.splice(i, 1);
      save();
    };
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function save() {
  localStorage.setItem('birthdays', JSON.stringify(birthdays));
  render();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  let date = document.getElementById('date').value;

  if (!name || !date) return;

  // меняем формат YYYY-MM-DD → DD-MM-YYYY
  const [year, month, day] = date.split('-');
  date = `${day}-${month}-${year}`;

  birthdays.push({ name, date });
  save();

  form.reset();
});

render();
