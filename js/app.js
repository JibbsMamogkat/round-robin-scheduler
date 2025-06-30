let processIdCounter = 0;

let processes = [];
const form = document.getElementById('process-form');
const processTable = document.querySelector('#process-table tbody');
const startButton = document.getElementById('start-simulation');
const quantumInput = document.getElementById('time-quantum');
const ganttChart = document.getElementById('gantt-chart');
const ganttLabels = document.getElementById('gantt-labels');
const queueGuide = document.getElementById('queue-guide');
const metricsDiv = document.getElementById('metrics');
const clearButton = document.getElementById('clear-all');
const addButton = document.getElementById('add-process-btn');
const processTableBody = document.querySelector('#process-table tbody');

const SCALE = 60;

function getColor(index, total) {
    const hue = (index * 360 / total) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}


form.addEventListener('submit', (e) => {
    e.preventDefault();
    addButton.classList.add('button-loading');
    addButton.disabled = true;

    setTimeout(() => {
        try {
            const name = document.getElementById('process-name').value;
            const arrival = parseInt(document.getElementById('arrival-time').value);
            const burst = parseInt(document.getElementById('burst-time').value);
        
            if (!name || isNaN(arrival) || isNaN(burst)) {
                alert('Please fill all fields correctly.');
                return;
            }
            const color = getColor(processes.length, processes.length + 1);
            const id = processIdCounter++;
            processes.push({ id, name, arrival, burst, remaining: burst, color });
        
            updateProcessTable();
            form.reset();
        } finally {
            addButton.classList.remove('button-loading');
            addButton.disabled = false;
        }
    }, 100);
});

function updateProcessTable() {
    processTableBody.innerHTML = '';
    processes.forEach(p => {
        const row = `
            <tr data-process-id="${p.id}">
                <td>${p.name}</td>
                <td>${p.arrival}</td>
                <td>
                    ${p.burst}
                    <button class="remove-btn" data-process-id="${p.id}">Remove</button>
                </td>
            </tr>
        `;
        processTableBody.innerHTML += row;
    });
}


function removeProcess(idToRemove) {
    const index = processes.findIndex(p => p.id === idToRemove);
    if (index === -1) return;

    const processToRemove = processes[index];
    if (confirm(`Are you sure you want to remove process ${processToRemove.name}?`)) {
        processes.splice(index, 1);
        updateProcessTable(); 

        runAndRenderSimulation();
    }
}
processTableBody.addEventListener('click', (e) => {
    const removeButton = e.target.closest('.remove-btn');
    if (removeButton) {
        const idToRemove = parseInt(removeButton.dataset.processId);
        removeProcess(idToRemove);
    }
});

startButton.addEventListener('click', () => {
    const quantum = parseInt(quantumInput.value);
    if (isNaN(quantum) || quantum <= 0) { alert('Enter a valid time quantum!'); return; }
    if (processes.length === 0) { alert('Add at least one process!'); return; }

    startButton.classList.add('button-loading');
    clearButton.disabled = true;
    startButton.disabled = true;
    addButton.disabled = true;

    setTimeout(() => {
        try {
            runAndRenderSimulation();
        } finally {
            startButton.classList.remove('button-loading');
            clearButton.disabled = false;
            startButton.disabled = false;
            addButton.disabled = false;
        }
    }, 10);
});

function simulateRoundRobin(quantum) {
    const readyQueue = [];
    const timeline = [];
    const guideSteps = [];
    let time = 0;
    const completed = [];

    const processMap = JSON.parse(JSON.stringify(processes));
    processMap.forEach(p => p.inQueue = false);
    processMap.sort((a, b) => a.arrival - b.arrival);

    while (completed.length < processMap.length) {
        processMap.forEach(p => {
            if (p.arrival <= time && !p.inQueue && p.remaining > 0) {
                readyQueue.push(p);
                p.inQueue = true;
            }
        });

        if (readyQueue.length === 0) {
            let nextArrival = processMap.find(p => p.remaining > 0 && p.arrival > time);
            if (!nextArrival) break;
            time = nextArrival.arrival;
            continue;
        }

        const current = readyQueue.shift();
        const execTime = Math.min(current.remaining, quantum);
        const startTime = time;

        const snapshot = [];
        if (current.arrival <= startTime && current.remaining > 0) {
           snapshot.push(current);
        }
        readyQueue.forEach(p => {
            if (p.arrival <= startTime && p.remaining > 0) {
                snapshot.push(p);
            }
        });

        guideSteps.push({
            time: `T=${startTime}`,
            queue: snapshot,
            executedId: current.id,
            finished: current.remaining - execTime <= 0
        });

        time += execTime;
        current.remaining -= execTime;

        processMap.forEach(p => {
            if (p.arrival > startTime && p.arrival <= time && !p.inQueue && p.remaining > 0) {
                readyQueue.push(p);
                p.inQueue = true;
            }
        });

        if (current.remaining > 0) {
            readyQueue.push(current);
        } else {
            current.completionTime = time;
            completed.push(current);
        }

        timeline.push({
            name: current.name,
            start: startTime,
            end: time,
            color: current.color
        });
    }

    return { timeline, guideSteps, completed };
}

function runAndRenderSimulation() {
    const quantum = parseInt(quantumInput.value);

    if (isNaN(quantum) || quantum <= 0 || processes.length === 0) {
        ganttChart.innerHTML = '';
        ganttLabels.innerHTML = '';
        queueGuide.innerHTML = '';
        calculateAndDisplayMetrics([]); 
        return;
    }
    
    const { timeline, guideSteps, completed } = simulateRoundRobin(quantum);

    ganttChart.innerHTML = '';
    ganttLabels.innerHTML = '';
    queueGuide.innerHTML = '';
    
    if (timeline.length > 0) {
        renderGanttChart(timeline);
        renderQueueGuide(guideSteps, timeline);
        calculateAndDisplayMetrics(completed);
    }
}


function renderGanttChart(timeline) {
    if (!timeline || timeline.length === 0) return;

    const MIN_READABLE_WIDTH = 40; 
    
    const totalTime = timeline[timeline.length - 1].end;
    const chartWidth = totalTime * SCALE;
    ganttChart.style.width = `${chartWidth}px`;
    ganttLabels.style.width = `${chartWidth}px`;

    timeline.forEach(block => {
        const div = document.createElement('div');
        div.className = 'gantt-block';
        div.title = block.name; 

        const blockWidth = (block.end - block.start) * SCALE;

        if (blockWidth < MIN_READABLE_WIDTH) {

            div.classList.add('gantt-block-small');
            
            const externalLabel = document.createElement('span');
            externalLabel.className = 'gantt-external-label';
            externalLabel.textContent = block.name;
            div.appendChild(externalLabel);

        } else {
            div.textContent = block.name;
        }

        div.style.left = `${block.start * SCALE}px`;
        div.style.width = `${blockWidth}px`;
        div.style.backgroundColor = block.color;
        ganttChart.appendChild(div);
    });

    for (let i = 0; i <= totalTime; i++) {
        const label = document.createElement('div');
        label.className = 'gantt-label';
        label.textContent = i;
        label.style.left = `${i * SCALE - 5}px`;
        ganttLabels.appendChild(label);
    }
}

function renderQueueGuide(guideSteps, timeline) {
    queueGuide.style.width = ganttChart.style.width;
    queueGuide.innerHTML = '';

    const displayedProcessIdsByStep = [];

    guideSteps.forEach((step, i) => {
        const execTime = timeline[i].end - timeline[i].start;
        const stepDiv = document.createElement('div');
        stepDiv.className = 'queue-step';
        stepDiv.style.left = `${timeline[i].start * SCALE}px`;
        stepDiv.style.width = `${execTime * SCALE}px`;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'queue-time';
        timeDiv.textContent = step.time;
        stepDiv.appendChild(timeDiv);

        const processesContainer = document.createElement('div');
        processesContainer.className = 'queue-processes';

        const filteredQueue = step.queue.filter(p => p.remaining > 0 || p.id === step.executedId);

        const processIdsForStep = {};

        filteredQueue.forEach((p, j) => {
            const domId = `proc-step-${i}-item-${p.id}`;
            processIdsForStep[p.id] = domId;

            const processDiv = document.createElement('div');
            processDiv.className = 'queue-process';
            processDiv.id = domId;

            processDiv.title = p.name;

            if (p.id === step.executedId) {
                if (step.finished) {
                    processDiv.classList.add('process-finished');
                } else {
                    processDiv.classList.add('process-executing');
                }
            }
            processDiv.textContent = p.name;
            processesContainer.appendChild(processDiv);
        });

        stepDiv.appendChild(processesContainer);
        queueGuide.appendChild(stepDiv);

        displayedProcessIdsByStep.push(processIdsForStep);
    });

    setTimeout(() => {
        const container = document.getElementById('queue-guide-container');
        
        const existingSVGs = container.querySelectorAll('svg.process-connection-svg');
        existingSVGs.forEach(svg => svg.remove());

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('process-connection-svg');

        const defs = document.createElementNS(svgNS, 'defs');
        svg.appendChild(defs);

        const lastSeenProcess = {};
        const verticalOffset = 35;
        const yGap = 4;

        const createdMarkers = {};

        guideSteps.forEach((step, i) => {
            step.queue.forEach(proc => {

                const procId = proc.id;
                const currentDomId = displayedProcessIdsByStep[i][procId];
                if (!currentDomId) return;

                const currentEl = document.getElementById(currentDomId);

                if (lastSeenProcess[procId]) {
                    const prevDomId = lastSeenProcess[procId];
                    const prevEl = document.getElementById(prevDomId);

                    if (prevEl && currentEl) {
                        const horizontalOffset = (i % 2 === 0) ? -5 : 5;

                        const startX = prevEl.offsetParent.offsetLeft + prevEl.offsetLeft + prevEl.offsetWidth / 2 + horizontalOffset;
                        const endX = currentEl.offsetParent.offsetLeft + currentEl.offsetLeft + currentEl.offsetWidth / 2 - horizontalOffset;

                        const startY = prevEl.offsetParent.offsetTop + prevEl.offsetHeight + verticalOffset + yGap;
                        const endY = currentEl.offsetParent.offsetTop + currentEl.offsetHeight + verticalOffset - yGap;
                        const midY = Math.max(startY, endY) + 30;

                        const pathData = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
                        const path = document.createElementNS(svgNS, 'path');
                        path.setAttribute('d', pathData);
                        
                        const procOriginal = processes.find(p => p.id === procId);
                        const strokeColor = procOriginal ? procOriginal.color : '#007bff';

                        path.setAttribute('stroke', strokeColor);
                        path.setAttribute('stroke-width', '2');
                        path.setAttribute('fill', 'none');

                        if (!createdMarkers[strokeColor]) {
                            const marker = document.createElementNS(svgNS, 'marker');
                            const markerId = `arrowhead-${strokeColor.replace(/[#(),\s%]/g, '')}`;

                            marker.setAttribute('id', markerId);
                            marker.setAttribute('viewBox', '0 0 10 10');
                            marker.setAttribute('refX', '5');
                            marker.setAttribute('refY', '5');
                            marker.setAttribute('markerWidth', '6');
                            marker.setAttribute('markerHeight', '6');
                            marker.setAttribute('orient', 'auto-start-reverse');

                            const pathMarker = document.createElementNS(svgNS, 'path');
                            pathMarker.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                            pathMarker.setAttribute('fill', strokeColor);

                            marker.appendChild(pathMarker);
                            defs.appendChild(marker);
                            createdMarkers[strokeColor] = markerId;
                        }

                        path.setAttribute('marker-end', `url(#${createdMarkers[strokeColor]})`);
                        svg.appendChild(path);
                    }
                }
                lastSeenProcess[procId] = currentDomId;
            });
        });
        container.appendChild(svg);
    }, 100);
}

function calculateAndDisplayMetrics(completed) {
    if (!completed || completed.length === 0) {
        resetToPlaceholderState();
        return;
    }
    let totalWaitingTime = 0;
    let totalTurnaroundTime = 0;
    let tableBodyHTML = '';

    completed.sort((a, b) => a.id - b.id);

    completed.forEach(p => {
        const originalProcess = processes.find(op => op.id === p.id);
        p.turnaroundTime = p.completionTime - originalProcess.arrival;
        p.waitingTime = p.turnaroundTime - originalProcess.burst;

        totalWaitingTime += p.waitingTime;
        totalTurnaroundTime += p.turnaroundTime;

        tableBodyHTML += `
            <tr>
                <td>${p.name}</td>
                <td>${p.completionTime}</td>
                <td>${p.turnaroundTime.toFixed(2)}</td>
                <td>${p.waitingTime.toFixed(2)}</td>
            </tr>
        `;
    });
    const avgWaitingTime = totalWaitingTime / completed.length;
    const avgTurnaroundTime = totalTurnaroundTime / completed.length;
    const fullTableHTML = `
        <table id="results-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>End Time</th>
                    <th>Turnaround Time</th>
                    <th>Waiting Time</th>
                </tr>
            </thead>
            <tbody>
                ${tableBodyHTML}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2"><strong>Averages</strong></td>
                    <td><strong>${avgTurnaroundTime.toFixed(2)}</strong></td>
                    <td><strong>${avgWaitingTime.toFixed(2)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
    metricsDiv.innerHTML = fullTableHTML;
}
window.addEventListener('load', () => {
    processIdCounter = 0;
    processes.length = 0;

    const exampleProcesses = [
        { name: 'P1', arrival: 3, burst: 4 },
        { name: 'P4', arrival: 0, burst: 7 },
        { name: 'P2', arrival: 5, burst: 9 },
        { name: 'P3', arrival: 8, burst: 4 },
        { name: 'P5', arrival: 12, burst: 6 }
    ];

    exampleProcesses.forEach((p, idx) => {
        const color = getColor(idx, exampleProcesses.length);
        const id = processIdCounter++;
        processes.push({
            id,
            ...p,
            remaining: p.burst,
            color
        });
    });

    updateProcessTable();
    quantumInput.value = 3;

    setTimeout(() => {
        startButton.click();
    }, 200);
});

clearButton.addEventListener('click', () => {
    if (processes.length === 0) {
        alert("There is nothing to clear.");
        return;
    }

    if (confirm("Are you sure you want to clear all processes and results?")) {
        clearButton.classList.add('button-loading');
        startButton.disabled = true;
        clearButton.disabled = true;
        addButton.disabled = true;

        setTimeout(() => {
            try {
                processIdCounter = 0;
                processes.length = 0;
                quantumInput.value = '';

                updateProcessTable();
                resetToPlaceholderState();

            } finally {
                clearButton.classList.remove('button-loading');
                startButton.disabled = false;
                clearButton.disabled = false;
                addButton.disabled = false;
            }
        }, 10);
    }
});



function resetToPlaceholderState() {
    ganttChart.innerHTML = '';
    ganttLabels.innerHTML = '';
    queueGuide.innerHTML = '';
    metricsDiv.innerHTML = '';
    
    const svgArrows = document.querySelectorAll('.process-connection-svg');
    svgArrows.forEach(svg => svg.remove());

    ganttChart.innerHTML = `<p id="gantt-placeholder" class="placeholder-text">The Gantt chart will be generated here.</p>`;
    queueGuide.innerHTML = `<p id="queue-placeholder" class="placeholder-text">Add processes and start the simulation to see the Ready Queue timeline.</p>`;
 
    metricsDiv.innerHTML = `
        <table id="results-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>End Time</th>
                    <th>Turnaround Time</th>
                    <th>Waiting Time</th>
                </tr>
            </thead>
            <tbody id="results-body">
                <tr id="results-placeholder">
                    <td colspan="4" class="placeholder-text">Results will be calculated and displayed here.</td>
                </tr>
            </tbody>
            <tfoot id="results-foot"></tfoot>
        </table>
    `;
}
