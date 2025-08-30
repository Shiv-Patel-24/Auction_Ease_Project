const sampleListings = [
    {
        title: "Wooden Dining Table",
        description: "A sturdy wooden dining table with six chairs.",
        image: "https://www.stillandbloom.co.uk/cdn/shop/files/Barn_Dining_Table.jpg?v=1729852790&width=1500",
        price: 250.00,
        location: "New York, NY",
        country: "India"
    },
    {
        title: "Leather Sofa Set",
        description: "Comfortable three-piece leather sofa set.",
        image: "https://moderndesignfurnitures.com/cdn/shop/products/IMG_5085_448feeb6-a80f-45ca-badd-63b07cc9eac9.jpg?v=1706776587",
        price: 500.00,
        location: "Los Angeles, CA",
        country: "India"
    },
    {
        title: "Samsung 55\" TV",
        description: "4K UHD Smart TV in excellent condition.",
        image: "https://img.etimg.com/thumb/width-640,height-480,imgsize-17396,resizemode-75,msid-107267329/top-trending-products/electronics/tv-appliances/samsung-crystal-vision-4k-tv-features-price-pros-and-cons/samsung-crystal-vision-4k-tv.jpg",
        price: 400.00,
        location: "London",
        country: "UK"
    },
    {
        title: "Queen Size Bed",
        description: "Wooden queen-size bed with memory foam mattress.",
        image: "https://www.getmycouch.com/cdn/shop/files/WhatsAppImage2023-11-08at7.39.41PM_708cd79b-e14d-447f-af97-b6a93e0ef3dd.jpg?v=1706434096",
        price: 350.00,
        location: "Sydney",
        country: "Australia"
    },
    {
        title: "Kitchen Utensils",
        description: "Full set of stainless steel kitchen utensils.",
        image: "https://cdn.mos.cms.futurecdn.net/UWbJtsWtgGTme3CRNqzQ3A.jpg",
        price: 50.00,
        location: "Toronto",
        country: "Canada"
    },
    {
        title: "Bookshelf",
        description: "Tall wooden bookshelf with five shelves.",
        image: "https://i.etsystatic.com/11628910/r/il/08b81c/2328038284/il_570xN.2328038284_dl9o.jpg",
        price: 120.00,
        location: "Chicago, IL",
        country: "India"
    },
    {
        title: "Microwave Oven",
        description: "800W microwave oven with multiple settings.",
        image: "https://www.ikea.com/in/en/images/products/vaermd-microwave-oven-ikea-300-black__1337364_pe947844_s5.jpg",
        price: 80.00,
        location: "Houston, TX",
        country: "India"
    },
    {
        title: "Office Chair",
        description: "Ergonomic office chair with lumbar support.",
        image: "https://laurajamesfurniture.com/cdn/shop/files/parker-boucle-office-chair-white-with-black-metal-legs-laura-james-1.jpg?v=1718696296&width=1946",
        price: 150.00,
        location: "San Francisco, CA",
        country: "India"
    },
    {
        title: "Coffee Maker",
        description: "Drip coffee maker with 12-cup capacity.",
        image: "https://rukminim2.flixcart.com/image/850/1000/xif0q/coffee-maker/n/j/j/63153711-regalia-espresso-wonderchef-original-imah2fyed5hnvmep.jpeg?q=20&crop=false",
        price: 60.00,
        location: "Seattle, WA",
        country: "India"
    },
    {
        title: "Area Rug",
        description: "7x10 ft area rug with geometric patterns.",
        image: "https://www.rugsdirect.co.uk/cdn/shop/files/rug-lisa-2307-white-lisa-2307-white--7972_1200x853.webp?v=1725606490",
        price: 200.00,
        location: "Miami, FL",
        country: "India"
    },
    {
        title: "Bedside Lamp",
        description: "Modern bedside lamp with touch controls.",
        image: "https://i.etsystatic.com/31787549/r/il/b64237/4927754517/il_1080xN.4927754517_qhe9.jpg",
        price: 45.00,
        location: "Boston, MA",
        country: "India"
    },
    {
        title: "Recliner Chair",
        description: "Comfortable recliner chair with footrest.",
        image: "https://valyoufurniture.com/cdn/shop/files/SleekElectricalChair_9.jpg",
        price: 300.00,
        location: "Denver, CO",
        country: "India"
    },
    {
        title: "Dining Set",
        description: "Glass dining table with four chairs.",
        image: "https://mywakeup.in/cdn/shop/files/Interior_1.jpg?v=1726133121&width=1214",
        price: 400.00,
        location: "Atlanta, GA",
        country: "India"
    },
    {
        title: "Blender",
        description: "High-speed blender perfect for smoothies.",
        image: "https://m.media-amazon.com/images/I/81p-MlSSh2L._AC_UF894,1000_QL80_.jpg",
        price: 70.00,
        location: "Portland, OR",
        country: "India"
    },
    {
        title: "Wardrobe",
        description: "Spacious two-door wooden wardrobe.",
        image: "https://greentechinteriors.in/wp-content/uploads/2023/08/wardrobe-design-1024x768.jpg",
        price: 350.00,
        location: "Philadelphia, PA",
        country: "India"
    },
    {
        title: "Patio Set",
        description: "Outdoor patio set with table and four chairs.",
        image: "https://m.media-amazon.com/images/I/91M4bSjWLBL.jpg",
        price: 500.00,
        location: "San Diego, CA",
        country: "India"
    },
    {
        title: "Bookshelf Speaker",
        description: "Pair of high-fidelity bookshelf speakers.",
        image: "https://www.ikea.com/in/en/images/products/symfonisk-wi-fi-bookshelf-speakers-black-set-of-2-gen-2__1168827_pe892256_s5.jpg?f=s",
        price: 250.00,
        location: "Austin, TX",
        country: "India"
    },
    {
        title: "Electric Kettle",
        description: "1.7-liter electric kettle with auto shut-off.",
        image: "https://myborosil.com/cdn/shop/products/my-borosil-electric-kettles-electric-glass-kettle-1-8l-30552715296906.jpg",
        price: 40.00,
        location: "Columbus, OH",
        country: "India"
    },
    {
        title: "Floor Lamp",
        description: "Adjustable floor lamp with LED lighting.",
        image: "https://images-cdn.ubuy.co.in/6663ea020756f655446bf424-lavish-home-tripod-floor-lamp-58.jpg",
        price: 90.00,
        location: "Charlotte, NC",
        country: "India"
    },
    {
        title: "Gaming Chair",
        description: "Ergonomic gaming chair with adjustable armrests.",
        image: "https://m.media-amazon.com/images/I/81XkyCyTw9L.jpg",
        price: 180.00,
        location: "Las Vegas, NV",
        country: "India"
    }
];

module.exports = { data : sampleListings }
