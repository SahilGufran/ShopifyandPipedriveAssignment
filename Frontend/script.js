document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById('orderId').value;
    const messageDiv = document.getElementById('message');

    try {
        const response = await fetch('http://localhost:3000/sync-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId }),
        });

        const result = await response.json();

        if (result.success) {
            messageDiv.textContent = 'Order synced successfully!';
            messageDiv.style.color = 'green';
        } else {
            messageDiv.textContent = `Failed to sync order: ${result.message}`;
            messageDiv.style.color = 'red';
        }
    } catch (error) {
        messageDiv.textContent = ` ${error.message}`;
        messageDiv.style.color = 'red';
    }
});
