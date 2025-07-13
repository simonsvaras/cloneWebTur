let userTestingUsername = "UsernameNotSet";
(function() {
    const MASTER_PASSWORD = "myMasterPass"; // Define master password here
    
    if (localStorage.getItem("authenticated")) return; // Skip if already authenticated
    
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgb(0, 0, 0)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.color = "#e0e0e0";
    modal.style.zIndex = "10000";
    
    const title = document.createElement("h2");
    title.innerText = "Welcome! Please wait for the instructions and master password.";
    
    const usernameInput = document.createElement("input");
    usernameInput.placeholder = "Enter your name";
    usernameInput.style.margin = "10px";
    usernameInput.style.padding = "8px";
    usernameInput.style.fontSize = "16px";
    
    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.placeholder = "Enter master password";
    passwordInput.style.margin = "10px";
    passwordInput.style.padding = "8px";
    passwordInput.style.fontSize = "16px";
    
    const submitBtn = document.createElement("button");
    submitBtn.innerText = "Submit";
    submitBtn.style.margin = "10px";
    submitBtn.style.padding = "10px 20px";
    submitBtn.style.fontSize = "16px";
    submitBtn.style.cursor = "pointer";
    submitBtn.style.backgroundColor = "#007bff";
    submitBtn.style.borderRadius = "4px";
    submitBtn.style.border = "none";
    submitBtn.style.color = "#e0e0e0";
    
    submitBtn.onclick = function() {
        if (passwordInput.value === MASTER_PASSWORD) {
            localStorage.setItem("authenticated", "true");
            localStorage.setItem("username", usernameInput.value);
            document.body.removeChild(modal);
        } else {
            alert("Incorrect password! Please try again.");
        }
    };
    
    modal.appendChild(title);
    modal.appendChild(usernameInput);
    modal.appendChild(passwordInput);
    modal.appendChild(submitBtn);
    document.body.appendChild(modal);
})();


(function() {
    // Create floating menu
    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.top = '10px';
    menu.style.right = '20px';
    menu.style.background = 'rgba(0, 0, 0, 0.8)';
    menu.style.padding = '10px';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    menu.style.display = 'flex';
    menu.style.gap = '10px';
    menu.style.zIndex = 3;

    function createButton(text, callback, background = "white") {
        const button = document.createElement('button');
        button.innerText = text;
        button.style.padding = '8px 12px';
        button.style.background = background;
        button.style.border = 'none';
        button.style.cursor = 'pointer';
        button.style.borderRadius = '5px';
        button.onclick = callback;
        return button;
    }

    function sendData() {
        const data = {
            username: localStorage.getItem("username") || "Unknown",
            JSONdata: generateJSON(),
        };

        fetch('userTesting/collect.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(response => response.text())
        .then(result => alert('Server response: ' + result))
        .catch(error => alert('Error: ' + error));
    }

    // Error Reporting Feature
    function sendErrorReport(errorData) {
        fetch("userTesting/error_report.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(errorData)
        });
        alert("An error has been detected. Error log has been sent to the developers.");
    }

    window.onerror = function(message, source, lineno, colno, error) {
        sendErrorReport({

            username: localStorage.getItem("username") || "Unknown",
            message,
            source,
            line: lineno,
            column: colno,
            stack: error ? error.stack : "No stack trace",
            userAgent: navigator.userAgent
        });
    };

    menu.appendChild(createButton('Save', ()=>{generateJSON(); alert("Saved")}));
    menu.appendChild(createButton('Remove save', () => {localStorage.removeItem("savedPositions"); alert('Save removed')}));
    menu.appendChild(createButton('Send', sendData, "#ffcc00"));
    menu.appendChild(createButton('Change username', ()=>{localStorage.removeItem("authenticated"); localStorage.removeItem("username"); alert("Your username has been cleared. Once you reload the page you can choose a new one.")}, "rgb(255 53 0)"));

    document.body.appendChild(menu);
})();/*Vygenerovano chatGPT */
