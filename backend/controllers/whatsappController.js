const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

exports.getSettings = async (req, res) => {
    try {
        let settings = await prisma.whatsAppSetting.findFirst();
        if (!settings) {
            // Create default settings if none exist
            settings = await prisma.whatsAppSetting.create({
                data: {
                    apiUrl: 'http://whatsappapi.fastsmsindia.com/wapp/api/send',
                    isActive: true
                }
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { apiKey, apiUrl, isActive, salesTemplate, quotationTemplate, paymentTemplate, creditTemplate } = req.body;
        let settings = await prisma.whatsAppSetting.findFirst();

        if (settings) {
            settings = await prisma.whatsAppSetting.update({
                where: { id: settings.id },
                data: { apiKey, apiUrl, isActive, salesTemplate, quotationTemplate, paymentTemplate, creditTemplate }
            });
        } else {
            settings = await prisma.whatsAppSetting.create({
                data: { apiKey, apiUrl, isActive, salesTemplate, quotationTemplate, paymentTemplate, creditTemplate }
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { mobile, message } = req.body;
        const settings = await prisma.whatsAppSetting.findFirst();

        if (!settings || !settings.isActive || !settings.apiKey) {
            return res.status(400).json({ message: 'WhatsApp integration is not configured or is inactive' });
        }

        const url = `${settings.apiUrl}?apikey=${settings.apiKey}&mobile=${mobile}&msg=${encodeURIComponent(message)}`;

        const response = await axios.get(url);

        // Log the message
        await prisma.whatsAppLog.create({
            data: {
                mobile,
                message,
                status: response.data?.status === 'success' || response.data?.responseCode === '200' ? 'SENT' : 'FAILED'
            }
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const { mobile, startDate, endDate } = req.query;
        let where = {};

        if (mobile) {
            where.mobile = { contains: mobile };
        }

        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.timestamp.lte = end;
            }
        }

        const logs = await prisma.whatsAppLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: 500 // Limit to last 500 logs for performance
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
