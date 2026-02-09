import { TiramisuPlayer } from "../../src/Client.js";

// Mock customer data - in real applications, this would come from an API
const customerData = {
    name: "Sarah Johnson",
    location: "San Francisco, CA",
    favoriteProduct: "Wireless Headphones",
    purchaseHistory: [
        { product: "Smart Watch", amount: 299, date: "2024-01-15" },
        { product: "Laptop Stand", amount: 89, date: "2024-02-20" },
        { product: "Wireless Headphones", amount: 199, date: "2024-03-10" }
    ],
    loyaltyTier: "Gold",
    interests: ["Music", "Fitness", "Technology"]
};

const player = new TiramisuPlayer({
    width: 1920, height: 1080, fps: 60, durationSeconds: 15,
    canvas: "personalization-canvas",
    videos: ['/template.mp4'],
    data: customerData
});

// Dynamic personalized video render function
const renderPersonalizedVideo = ({ ctx, width, height, frame, fps, localProgress, data, layer, utils }) => {
    const time = frame / fps;
    
    // Background with customer location-based theme
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    if (data.loyaltyTier === "Gold") {
        gradient.addColorStop(0, "#FFD700");
        gradient.addColorStop(1, "#FFA500");
    } else if (data.loyaltyTier === "Silver") {
        gradient.addColorStop(0, "#C0C0C0");
        gradient.addColorStop(1, "#808080");
    } else {
        gradient.addColorStop(0, "#4CAF50");
        gradient.addColorStop(1, "#45a049");
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Personalized header with name animation
    ctx.save();
    ctx.translate(width/2, 100);
    const nameScale = Math.sin(localProgress * Math.PI * 2) * 0.1 + 1;
    ctx.scale(nameScale, nameScale);
    
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 72px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Welcome back, ${data.name}!`, 0, 0);
    
    ctx.restore();
    
    // Purchase history visualization
    const historyY = 200;
    const historyHeight = 300;
    const barWidth = 120;
    const maxAmount = Math.max(...data.purchaseHistory.map(p => p.amount));
    
    data.purchaseHistory.forEach((purchase, index) => {
        const x = 100 + index * (barWidth + 50);
        const barHeight = (purchase.amount / maxAmount) * historyHeight;
        const barY = historyY + historyHeight - barHeight;
        
        // Animated bar
        const barProgress = Math.min(localProgress * 3 - index * 0.2, 1);
        const currentHeight = barHeight * barProgress;
        
        ctx.fillStyle = `hsl(${240 - index * 60}, 70%, 60%)`;
        ctx.fillRect(x, historyY + historyHeight - currentHeight, barWidth, currentHeight);
        
        // Product labels
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(x + barWidth/2, historyY + historyHeight + 30);
        ctx.rotate(-Math.PI/6);
        ctx.fillText(purchase.product, 0, 0);
        ctx.restore();
        
        // Amount labels
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px Arial";
        ctx.fillText(`$${purchase.amount}`, x + barWidth/2, barY - 10);
    });
    
    // Personalized recommendations
    const recLayer = layer.create(width, height);
    recLayer.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    recLayer.ctx.fillRect(0, height - 200, width, 200);
    
    recLayer.ctx.fillStyle = "#FFD700";
    recLayer.ctx.font = "bold 36px Arial";
    recLayer.ctx.textAlign = "center";
    recLayer.ctx.fillText(`Recommended for you: ${data.favoriteProduct}`, width/2, height - 140);
    
    recLayer.ctx.fillStyle = "#ffffff";
    recLayer.ctx.font = "24px Arial";
    recLayer.ctx.fillText(`Based on your interest in ${data.interests.slice(0, 2).join(" & ")}`, width/2, height - 100);
    
    // Loyalty tier benefits
    const benefits = data.loyaltyTier === "Gold" ? 
        ["5% Cashback", "Free Shipping", "Priority Support", "Early Access"] :
        data.loyaltyTier === "Silver" ?
        ["3% Cashback", "Free Shipping on $50+", "Standard Support"] :
        ["1% Cashback", "Standard Shipping"];
    
    benefits.forEach((benefit, index) => {
        const alpha = Math.sin((localProgress + index * 0.1) * Math.PI * 4) * 0.3 + 0.7;
        recLayer.ctx.globalAlpha = alpha;
        recLayer.ctx.fillStyle = "#00ff88";
        recLayer.ctx.font = "20px Arial";
        recLayer.ctx.textAlign = "left";
        recLayer.ctx.fillText(`✓ ${benefit}`, 50 + index * 200, height - 60);
    });
    
    recLayer.drawTo(ctx);
    
    // Location-based weather effect (simulated)
    const weatherParticleCount = Math.floor(20 + Math.sin(localProgress * Math.PI * 2) * 10);
    for (let i = 0; i < weatherParticleCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 50 + 50;
        const size = Math.random() * 3 + 1;
        const opacity = Math.random() * 0.5 + 0.2;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Dynamic pricing based on loyalty
    const basePrice = 199;
    const discount = data.loyaltyTier === "Gold" ? 0.15 : data.loyaltyTier === "Silver" ? 0.10 : 0.05;
    const finalPrice = Math.round(basePrice * (1 - discount));
    
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Special Price: $${finalPrice} (${Math.round(discount * 100)}% off for ${data.loyaltyTier} members)`, width/2, height - 20);
};

player.addClip(0, 15, renderPersonalizedVideo);
player.load();

// Batch generation for multiple customers
async function generateBatchVideos(customers) {
    const results = [];
    
    for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        console.log(`Generating video for ${customer.name}...`);
        
        // Update player with new customer data
        player.updateData(customer);
        
        // Generate video
        const response = await fetch('/api/render-personalized', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId: customer.id,
                template: 'personalized-offer',
                customerData: customer,
                outputFormat: 'mp4'
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            results.push({
                customerId: customer.id,
                name: customer.name,
                videoBlob: blob,
                fileName: `personalized-${customer.name.replace(/\s+/g, '-').toLowerCase()}.mp4`
            });
        }
    }
    
    return results;
}

// Export functions for server-side usage
if (typeof window !== 'undefined') {
    (window as any).generateBatchVideos = generateBatchVideos;
    (window as any).customerData = customerData;
}

export { generateBatchVideos, customerData };