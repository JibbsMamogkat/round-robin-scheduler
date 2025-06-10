const processes = [];
const form = document.getElementById('process-form');
const processTable = document.querySelector('#process-table tbody');
const startButton = document.getElementById('start-simulation');
const quantumInput = document.getElementById('time-quantum');
const ganttChart = document.getElementById('gantt-chart');
const metricsDiv = document.getElementById('metrics');

// Add process to list
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('process-name').value;
    const arrival = parseInt(document.getElementById('arrival-time').value);
    const burst = parseInt(document.getElementById('burst-time').value);

    processes.push({ name, arrival, burst, remaining: burst });
    updateProcessTable();

    form.reset();
});

function updateProcessTable() {
    processTable.innerHTML = '';
    processes.forEach(p => {
        const row = `<tr><td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td></tr>`;
        processTable.innerHTML += row;
    });
}

// Round Robin Simulation
startButton.addEventListener('click', () => {
    const quantum = parseInt(quantumInput.value);
    if (isNaN(quantum) || quantum <= 0) return alert('Enter a valid time quantum!');

    ganttChart.innerHTML = '';
    metricsDiv.innerHTML = '';

    simulateRoundRobin(quantum);
});

function simulateRoundRobin(quantum) {
    const queue = [];
    const timeline = [];
    let time = 0;
    const completed = [];
    const processMap = JSON.parse(JSON.stringify(processes)); // deep copy

    while (completed.length < processMap.length) {
        // Add newly arrived processes to the queue
        processMap.forEach(p => {
            if (p.arrival <= time && !p.inQueue && p.remaining > 0) {
                queue.push(p);
                p.inQueue = true;
            }
        });

        if (queue.length === 0) {
            time++;
            continue;
        }

        const current = queue.shift();
        const execTime = Math.min(current.remaining, quantum);

        timeline.push({ name: current.name, start: time, end: time + execTime });

        time += execTime;
        current.remaining -= execTime;

        // Re-add to queue if not finished
        if (current.remaining > 0) {
            queue.push(current);
        } else {
            completed.push(current);
        }

        // Re-check for new arrivals during execution
        processMap.forEach(p => {
            if (p.arrival <= time && !p.inQueue && p.remaining > 0) {
                queue.push(p);
                p.inQueue = true;
            }
        });
    }

    renderGanttChart(timeline);
}

function renderGanttChart(timeline) {
    timeline.forEach(block => {
        const div = document.createElement('div');
        div.className = 'gantt-block';
        div.textContent = `${block.name} (${block.start}-${block.end})`;
        ganttChart.appendChild(div);
    });
}
