const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors'); 
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

//  API keys and tokens
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_PASSWORD;
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME;
const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;


app.use(cors()); // Use the cors middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'frontend'))); // For static files

const getShopifyOrder = async (orderId) => {
    try {
        const response = await axios.get(`https://${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}@${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2021-04/orders/${orderId}.json`);
        return response.data.order;
    } catch (error) {
        console.error('Error fetching Shopify order:', error);
        throw error;
    }
};

const findOrCreatePersonInPipedrive = async (customer) => {
    try {
        const findPersonResponse = await axios.get(`https://api.pipedrive.com/v1/persons/search`, {
            params: {
                term: customer.email,
                api_token: PIPEDRIVE_API_TOKEN,
            },
        });

        if (findPersonResponse.data.data && findPersonResponse.data.data.items.length > 0) {
            return findPersonResponse.data.data.items[0].item;
        } else {
            const createPersonResponse = await axios.post(`https://api.pipedrive.com/v1/persons`, {
                name: `${customer.first_name} ${customer.last_name}`,
                email: customer.email,
                phone: customer.phone,
                api_token: PIPEDRIVE_API_TOKEN,
            });
            return createPersonResponse.data.data;
        }
    } catch (error) {
        console.error('Error finding or creating person in Pipedrive:', error);
        throw error;
    }
};

const findOrCreateProductInPipedrive = async (lineItem) => {
    try {
        const findProductResponse = await axios.get(`https://api.pipedrive.com/v1/products/search`, {
            params: {
                term: lineItem.sku,
                api_token: PIPEDRIVE_API_TOKEN,
            },
        });

        if (findProductResponse.data.data && findProductResponse.data.data.items.length > 0) {
            return findProductResponse.data.data.items[0].item;
        } else {
            const createProductResponse = await axios.post(`https://api.pipedrive.com/v1/products`, {
                name: lineItem.name,
                code: lineItem.sku,
                prices: [
                    {
                        currency: 'USD',
                        price: lineItem.price,
                    },
                ],
                api_token: PIPEDRIVE_API_TOKEN,
            });
            return createProductResponse.data.data;
        }
    } catch (error) {
        console.error('Error finding or creating product in Pipedrive:', error);
        throw error;
    }
};

const createDealInPipedrive = async (personId, title) => {
    try {
        const createDealResponse = await axios.post(`https://api.pipedrive.com/v1/deals`, {
            title,
            person_id: personId,
            api_token: PIPEDRIVE_API_TOKEN,
        });
        return createDealResponse.data.data;
    } catch (error) {
        console.error('Error creating deal in Pipedrive:', error);
        throw error;
    }
};

const attachProductToDeal = async (dealId, productId, quantity) => {
    try {
        const attachProductResponse = await axios.post(`https://api.pipedrive.com/v1/deals/${dealId}/products`, {
            product_id: productId,
            quantity,
            api_token: PIPEDRIVE_API_TOKEN,
        });
        return attachProductResponse.data.data;
    } catch (error) {
        console.error('Error attaching product to deal in Pipedrive:', error);
        throw error;
    }
};

app.post('/sync-order', async (req, res) => {
    const { orderId } = req.body;

    try {
        // Get Shopify order
        const order = await getShopifyOrder(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found in Shopify.' });
        }
        const customer = order.customer;

        if (!customer.email) {
            return res.status(400).json({ success: false, message: 'Customer email is missing.' });
        }

        // Find or create person in Pipedrive
        const person = await findOrCreatePersonInPipedrive(customer);

        //  Process line items
        const lineItems = order.line_items;
        const products = await Promise.all(lineItems.map(findOrCreateProductInPipedrive));

        // Create deal in Pipedrive
        const deal = await createDealInPipedrive(person.id, `Order ${order.id}`);

        // Step 5: Attach products to the created deal
        await Promise.all(products.map((product, index) => attachProductToDeal(deal.id, product.id, lineItems[index].quantity)));

        res.json({ success: true, message: 'Order synced successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to sync order.', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
});
