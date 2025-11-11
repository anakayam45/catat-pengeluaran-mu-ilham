// Global Variables
const EXPENSES_STORAGE_KEY = 'expense_tracker_data';
let expenses = [];
let lineChartInstance = null;
let donutChartInstance = null;

// --- UTILITY FUNCTIONS ---

// Load expenses from localStorage
const loadExpenses = () => {
    const json = localStorage.getItem(EXPENSES_STORAGE_KEY);
    expenses = json ? JSON.parse(json).map(item => ({
        ...item,
        amount: Number(item.amount), // Ensure amount is stored as a number
        timestamp: Number(item.timestamp) // Ensure timestamp is a number
    })) : [];
    // Sort by most recent first
    expenses.sort((a, b) => b.timestamp - a.timestamp);
};

// Save expenses to localStorage
const saveExpenses = () => {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
};

// Format Rupiah
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

// --- DATA MANAGEMENT & THEME ---

// Theme Customization
const applyTheme = (primary, secondary) => {
    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    localStorage.setItem('primaryColor', primary);
    localStorage.setItem('secondaryColor', secondary);
    if (lineChartInstance) lineChartInstance.destroy();
    if (donutChartInstance) donutChartInstance.destroy();
    renderCharts(document.getElementById('chart-filter').value);
};

const loadTheme = () => {
    const primary = localStorage.getItem('primaryColor') || '#007bff';
    const secondary = localStorage.getItem('secondaryColor') || '#f8f9fa';
    document.getElementById('primaryColor').value = primary;
    document.getElementById('secondaryColor').value = secondary;
    applyTheme(primary, secondary);
};

// --- CORE APPLICATION FUNCTIONS ---

// 1. Add New Expense
const addExpense = (e) => {
    e.preventDefault();

    const amountInput = document.getElementById('amount');
    const subjectInput = document.getElementById('subject');

    const amount = Number(amountInput.value);
    const subject = subjectInput.value.trim();

    if (amount <= 0 || subject === '') {
        alert('Nominal harus positif dan Subjek tidak boleh kosong!');
        return;
    }

    const now = new Date();
    const newExpense = {
        id: Date.now(),
        amount: amount,
        subject: subject,
        timestamp: now.getTime(),
        date: now.toLocaleDateString('en-CA'), // YYYY-MM-DD
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    expenses.unshift(newExpense); // Add to the beginning
    saveExpenses();

    // Reset form and update UI
    amountInput.value = '';
    subjectInput.value = '';
    updateUI();
};

// 2. Delete Expense
const deleteExpense = (id) => {
    if (confirm('Yakin ingin menghapus pengeluaran ini?')) {
        expenses = expenses.filter(exp => exp.id !== id);
        saveExpenses();
        updateUI();
    }
};

// 3. Render Table
const renderTable = (data = expenses) => {
    const tbody = document.querySelector('#expense-table tbody');
    tbody.innerHTML = '';

    data.forEach(expense => {
        const row = tbody.insertRow();
        
        // Date/Time
        row.insertCell().textContent = `${expense.date} ${expense.time}`;
        
        // Subject
        row.insertCell().textContent = expense.subject;

        // Nominal (Amount)
        const amountCell = row.insertCell();
        amountCell.textContent = formatRupiah(expense.amount);
        
        // Action (Delete Button)
        const actionCell = row.insertCell();
        actionCell.innerHTML = `<button class="delete-btn" onclick="deleteExpense(${expense.id})">🗑️</button>`;
        actionCell.style.textAlign = 'center';
    });
};

// 4. Update Summary
const updateSummary = () => {
    const totalTodayEl = document.getElementById('total-today');
    const totalMonthEl = document.getElementById('total-month');
    const grandTotalEl = document.getElementById('grand-total');

    const today = new Date().toLocaleDateString('en-CA');
    const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const totalToday = expenses
        .filter(exp => exp.date === today)
        .reduce((sum, exp) => sum + exp.amount, 0);

    const totalMonth = expenses
        .filter(exp => exp.date.substring(0, 7) === thisMonth)
        .reduce((sum, exp) => sum + exp.amount, 0);
        
    const grandTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    totalTodayEl.textContent = formatRupiah(totalToday);
    totalMonthEl.textContent = formatRupiah(totalMonth);
    grandTotalEl.textContent = formatRupiah(grandTotal);
};


// 5. Chart Data Generation
const generateChartData = (filter) => {
    // Grouping expenses based on the selected filter (Day, Hour, Month)
    const groupedData = {};
    const today = new Date().toLocaleDateString('en-CA');
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    // Filter expenses relevant to the current period (Today/This Month)
    let filteredExpenses = [];
    if (filter === 'day' || filter === 'hour') {
        filteredExpenses = expenses.filter(exp => exp.date === today);
    } else { // month
        filteredExpenses = expenses.filter(exp => exp.date.substring(0, 7) === thisMonth);
    }
    
    // Determine the key for grouping
    let keySelector;
    if (filter === 'hour') {
        keySelector = exp => exp.time.substring(0, 2); // Only the hour (HH)
    } else if (filter === 'month') {
        keySelector = exp => exp.date.substring(5, 7); // Month (MM)
    } else { // day
        keySelector = exp => exp.date.substring(8, 10); // Day (DD)
    }

    // Aggregate amount by the selected key (for Line Chart)
    filteredExpenses.forEach(exp => {
        const key = keySelector(exp);
        groupedData[key] = (groupedData[key] || 0) + exp.amount;
    });

    // Subject breakdown (for Donut Chart)
    const subjectData = {};
    filteredExpenses.forEach(exp => {
        const subject = exp.subject;
        subjectData[subject] = (subjectData[subject] || 0) + exp.amount;
    });

    // Prepare Line Chart Labels and Data
    let labels = Object.keys(groupedData).sort();
    let data = labels.map(key => groupedData[key]);
    
    if (filter === 'hour') {
        labels = labels.map(h => `${h}:00`);
    }

    return {
        line: { labels, data },
        donut: { labels: Object.keys(subjectData), data: Object.values(subjectData) }
    };
};

// 6. Render Charts
const renderCharts = (filter) => {
    const chartData = generateChartData(filter);
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    
    // Destroy previous instances to avoid rendering issues
    if (lineChartInstance) lineChartInstance.destroy();
    if (donutChartInstance) donutChartInstance.destroy();

    // --- Line Chart (Trend) ---
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: chartData.line.labels,
            datasets: [{
                label: `Total Pengeluaran (${filter})`,
                data: chartData.line.data,
                borderColor: primaryColor,
                backgroundColor: primaryColor + '40', // Semi-transparent
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // --- Donut Chart (Subject Breakdown) ---
    const donutCtx = document.getElementById('donutChart').getContext('2d');
    
    // Generate distinct colors for subjects
    const backgroundColors = chartData.donut.labels.map((_, i) => 
        `hsl(${(i * 360 / chartData.donut.labels.length) % 360}, 70%, 50%)`
    );

    donutChartInstance = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: chartData.donut.labels,
            datasets: [{
                data: chartData.donut.data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
};

// 7. Search/Filter Table
const searchTable = (query) => {
    const lowerQuery = query.toLowerCase();
    const filtered = expenses.filter(exp => 
        exp.subject.toLowerCase().includes(lowerQuery) ||
        formatRupiah(exp.amount).toLowerCase().includes(lowerQuery)
    );
    renderTable(filtered);
};

// 8. Export Data to CSV
const exportCSV = () => {
    let csv = 'ID,Date,Time,Amount,Subject\n';
    expenses.forEach(exp => {
        csv += `${exp.id},${exp.date},${exp.time},${exp.amount},"${exp.subject.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'expense_data.csv');
    link.click();
    URL.revokeObjectURL(url);
};


// 9. Master Update Function
const updateUI = () => {
    updateSummary();
    renderTable();
    // Re-render charts based on current filter setting
    renderCharts(document.getElementById('chart-filter').value);
};

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadExpenses();
    updateUI();
    
    // Main Form Listener
    document.getElementById('expense-form').addEventListener('submit', addExpense);
    
    // Theme Customization Listeners
    document.getElementById('primaryColor').addEventListener('input', (e) => applyTheme(e.target.value, document.getElementById('secondaryColor').value));
    document.getElementById('secondaryColor').addEventListener('input', (e) => applyTheme(document.getElementById('primaryColor').value, e.target.value));

    // Chart Filter Listener
    document.getElementById('chart-filter').addEventListener('change', (e) => renderCharts(e.target.value));

    // Search Listener
    document.getElementById('search-input').addEventListener('input', (e) => searchTable(e.target.value));

    // Export Listener
    document.getElementById('export-btn').addEventListener('click', exportCSV);

    // Initial Sort (by date, already done in loadExpenses)
});
