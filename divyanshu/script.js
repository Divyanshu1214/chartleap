// Common script for all pages

// For Graph Plotter page
if (document.getElementById('add-equation')) {
    const addEquationBtn = document.getElementById('add-equation');
    const plotGraphBtn = document.getElementById('plot-graph');
    const equationInputs = document.getElementById('equation-inputs');
    const errorMessage = document.getElementById('error-message');

    // Add new equation input field
    addEquationBtn.addEventListener('click', () => {
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'equation';
        newInput.placeholder = 'Try: y(t) = 13cos(t)... or x^2 + y^2 = 25';
        equationInputs.appendChild(newInput);
    });

    // Plot the graphs
    plotGraphBtn.addEventListener('click', () => {
        errorMessage.textContent = ''; // Clear previous errors
        const equations = Array.from(document.querySelectorAll('.equation'))
            .map(input => input.value.trim())
            .filter(eq => eq !== '');

        if (equations.length === 0) {
            errorMessage.textContent = 'Please enter at least one equation.';
            return;
        }

        const traces = [];
        
        // Define graph limits (Zoom area)
        const range = 15; 
        const step = 0.2; // Grid resolution for implicit plots
        const xRange = [];
        const yRange = [];
        // Generate grid points for Implicit plotting (Grid -15 to 15)
        for (let i = -range; i <= range; i += step) {
            xRange.push(i);
            yRange.push(i);
        }

        // Standard x-values for simple functions (Higher resolution)
        const xValuesSimple = Array.from({ length: 501 }, (_, i) => (i - 250) / 10); // -25 to 25

        equations.forEach((eq, index) => {
            try {
                const color = ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0'][index % 5];
                
                // --- CASE 1: Parametric Equations (x=...; y=...) ---
                if (eq.includes(';')) {
                    let parts = eq.split(';').map(p => p.trim());
                    if (parts.length !== 2) throw new Error(`Invalid parametric format. Use "x=...; y=..."`);
                    
                    let xExpr = parts[0].replace(/^x\s*(\(t\))?\s*=/i, '').trim(); // Handle x or x(t)
                    let yExpr = parts[1].replace(/^y\s*(\(t\))?\s*=/i, '').trim(); // Handle y or y(t)
                    
                    // Determine 't' range (0 to 2PI for trig, else -10 to 10)
                    let tValues;
                    if (xExpr.match(/sin|cos|tan/i) || yExpr.match(/sin|cos|tan/i)) {
                        tValues = Array.from({ length: 361 }, (_, i) => i * Math.PI / 180);
                    } else {
                        tValues = Array.from({ length: 201 }, (_, i) => (i - 100) / 10);
                    }

                    let xNode = math.parse(xExpr).compile();
                    let yNode = math.parse(yExpr).compile();
                    
                    traces.push({
                        x: tValues.map(t => xNode.evaluate({ t })),
                        y: tValues.map(t => yNode.evaluate({ t })),
                        mode: 'lines',
                        name: eq,
                        line: { width: 2, color: color }
                    });
                    return; 
                }

                // --- CASE 2: Polar Equations (r=... or theta) ---
                if (eq.toLowerCase().startsWith('r') || eq.match(/theta|\\theta/i)) {
                    // Remove 'r=' or 'r(theta)='
                    let expression = eq.replace(/^r(\([a-zA-Z]+\))?\s*=/i, '').trim();
                    let node = math.parse(expression).compile();
                    
                    let thetaValues = Array.from({ length: 361 }, (_, i) => i * Math.PI / 180);
                    let rValues = thetaValues.map(theta => node.evaluate({ theta }));
                    
                    traces.push({
                        x: rValues.map((r, i) => r * Math.cos(thetaValues[i])),
                        y: rValues.map((r, i) => r * Math.sin(thetaValues[i])),
                        mode: 'lines',
                        name: eq,
                        line: { width: 2, color: color }
                    });
                    return;
                }

                // --- CASE 3: Cartesian (Standard & Implicit) ---
                
                // Pre-processing: Split by '=' to see structure
                let parts = eq.split('=');
                let isExplicitY = false;
                let isExplicitX = false;
                let rightExpr = "";

                if (parts.length === 2) {
                    let leftRaw = parts[0].trim().toLowerCase();
                    rightExpr = parts[1].trim();
                    
                    // Normalize LHS: "y(t)" -> "y", "x(val)" -> "x"
                    let left = leftRaw.replace(/\([a-z0-9]+\)$/, '');

                    // Detect variable usage on RHS
                    let rightNode = math.parse(rightExpr);
                    let symbols = rightNode.filter(n => n.isSymbolNode).map(n => n.name);
                    // If 'y' is not in RHS, it's likely explicit y = ...
                    if (left === 'y' && !symbols.includes('y')) {
                        isExplicitY = true;
                    }
                    // If 'x' is not in RHS, it's likely explicit x = ...
                    else if (left === 'x' && !symbols.includes('x')) {
                        isExplicitX = true;
                    }
                } else if (!eq.includes('=')) {
                    // No '=' means assume y = expression
                    isExplicitY = true;
                    rightExpr = eq;
                }

                // MODE A: Fast Line Plot (Simple y=f(x) or y=f(t))
                if (isExplicitY) {
                    let compiled = math.parse(rightExpr).compile();
                    
                    // Check if the equation uses 't' instead of 'x' (e.g., y(t) = cos(t))
                    let rightNode = math.parse(rightExpr);
                    let symbols = rightNode.filter(n => n.isSymbolNode).map(n => n.name);
                    let usesT = symbols.includes('t') && !symbols.includes('x');

                    let yVals = xValuesSimple.map(val => {
                        try { 
                            // Map independent variable: if 't' is used, map val to 't', else to 'x'
                            let scope = usesT ? { t: val } : { x: val };
                            return compiled.evaluate(scope); 
                        } catch { return null; }
                    });
                    
                    traces.push({
                        x: xValuesSimple,
                        y: yVals,
                        mode: 'lines',
                        name: eq,
                        line: { width: 2, color: color }
                    });
                } 
                else if (isExplicitX) {
                    let compiled = math.parse(rightExpr).compile();
                    
                    // Check if uses 't'
                    let rightNode = math.parse(rightExpr);
                    let symbols = rightNode.filter(n => n.isSymbolNode).map(n => n.name);
                    let usesT = symbols.includes('t') && !symbols.includes('y');

                    let yVals = xValuesSimple; // treat simple array as Y input
                    let xVals = yVals.map(val => {
                        try { 
                            let scope = usesT ? { t: val } : { y: val };
                            return compiled.evaluate(scope); 
                        } catch { return null; }
                    });
                    
                    traces.push({
                        x: xVals,
                        y: yVals,
                        mode: 'lines',
                        name: eq,
                        line: { width: 2, color: color }
                    });
                }
                // MODE B: Universal Implicit Solver (Contours)
                // Handles: x^2+y^2=25, sin(x)=cos(y)
                else {
                    // Rearrange equation to form: f(x,y) = 0
                    let implicitExprString = "";
                    if (eq.includes('=')) {
                        let sides = eq.split('=');
                        implicitExprString = `(${sides[0]}) - (${sides[1]})`;
                    } else {
                        implicitExprString = eq; 
                    }

                    const compiled = math.parse(implicitExprString).compile();
                    
                    // Evaluate Z on 2D Grid
                    const zValues = [];
                    for (let j = 0; j < yRange.length; j++) {
                        const row = [];
                        const y = yRange[j];
                        for (let i = 0; i < xRange.length; i++) {
                            const x = xRange[i];
                            try {
                                // Evaluate f(x,y)
                                let val = compiled.evaluate({ x, y });
                                row.push(val);
                            } catch (e) {
                                row.push(NaN);
                            }
                        }
                        zValues.push(row);
                    }

                    // Add Contour Trace
                    traces.push({
                        type: 'contour',
                        x: xRange,
                        y: yRange,
                        z: zValues,
                        contours: {
                            coloring: 'none',
                            start: 0,
                            end: 0,
                            size: 0,
                            showlabels: false
                        },
                        line: {
                            width: 2,
                            color: color
                        },
                        showscale: false,
                        name: eq
                    });
                }

            } catch (e) {
                errorMessage.textContent += `Could not plot "${eq}": ${e.message}\n`;
                console.error(e);
            }
        });

        if (traces.length === 0) {
            errorMessage.textContent = 'No valid equations to plot.';
            return;
        }

        const layout = {
            title: { text: 'Universal Graph Plotter', font: { size: 20 } },
            xaxis: { title: 'x', autorange: true, zeroline: true },
            yaxis: { title: 'y', autorange: true, zeroline: true, scaleanchor: "x", scaleratio: 1 },
            showlegend: true,
            hovermode: 'closest',
            margin: { t: 50, b: 50, l: 50, r: 50 }
        };

        Plotly.newPlot('graph', traces, layout);
    });
}

// For Simulations page (unchanged logic)
if (document.getElementById('search-bar')) {
    const searchBar = document.getElementById('search-bar');
    const simulationItems = document.querySelectorAll('.simulation-item');

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        simulationItems.forEach(item => {
            const title = item.querySelector('h2').textContent.toLowerCase();
            const description = item.querySelector('p').textContent.toLowerCase();
            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// =============== POPUP FEEDBACK SYSTEM (chartleap) ===============
const floatBtn = document.getElementById('feedback-float');
const modal = document.getElementById('feedback-modal');
const closeBtn = document.getElementById('close-modal');
let selectedRating = 0;

if (floatBtn) {
    floatBtn.addEventListener('click', () => {
        modal.classList.add('show');
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
}

// Click outside modal to close
modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
});

// Star rating
document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
        selectedRating = star.dataset.value;
        document.querySelectorAll('.star').forEach(s => {
            s.classList.toggle('selected', s.dataset.value <= selectedRating);
        });
    });
});

// Submit feedback
document.getElementById('submit-feedback')?.addEventListener('click', () => {
    const name = document.getElementById('feedback-name').value.trim();
    const message = document.getElementById('feedback-message').value.trim();
    const status = document.getElementById('feedback-status');

    if (selectedRating === 0 || message.length < 5) {
        status.style.color = 'red';
        status.textContent = 'कृपया स्टार रेटिंग दें और मैसेज लिखें';
        return;
    }

    const review = { rating: selectedRating, name: name || 'Anonymous', message, date: new Date().toISOString() };
    const reviews = JSON.parse(localStorage.getItem('chartleap_reviews') || '[]');
    reviews.push(review);
    localStorage.setItem('chartleap_reviews', JSON.stringify(reviews));

    status.style.color = 'green';
    status.textContent = 'धन्यवाद! आपका फीडबैक मिल गया ❤️';

    setTimeout(() => {
        modal.classList.remove('show');
        status.textContent = '';
        document.getElementById('feedback-message').value = '';
        document.getElementById('feedback-name').value = '';
        document.querySelectorAll('.star').forEach(s => s.classList.remove('selected'));
        selectedRating = 0;
    }, 2000);
});