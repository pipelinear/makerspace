/* Example photographs are intentional. Replace image, alt, and credit together
   when the actual SBHS equipment and student-designed posters are available. */
window.MAKERSPACE = {
  tools: [
    {
      slug: '3d-printers', name: '3D printers', category: 'FABRICATION', number: '01',
      headline: ['Think', 'in 3D.'], color: '#b5ecbe', background: '#304239',
      image: 'https://images.unsplash.com/photo-1742971366169-6efb57949d56?auto=format&fit=crop&w=1200&q=85',
      alt: 'Close-up of the extruder and mechanical parts of a real 3D printer',
      credit: {name: 'Jakub Żerdzicki / Unsplash', url: 'https://unsplash.com/photos/3xgqjn_etWQ'},
      poster: 'Something that only existed in your head. Now something you can hold in your hands.',
      description: 'Build it one layer at a time. Turn a digital model into a physical object, try it out, and change the design until it feels right.',
      ideas: ['Prototype a part for a robot', 'Design a custom object or small sculpture', 'Make pieces for our mixed-material door'],
      note: 'Start with a small model and bring your design to Golden Time. The exact printer models will be added soon.'
    },
    {
      slug: 'laser-cutters', name: 'Laser cutters', category: 'FABRICATION', number: '02',
      headline: ['Cut', 'a path.'], color: '#ff7050', background: '#282e34',
      image: 'https://images.unsplash.com/photo-1738162837451-2041c1418f54?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real laser cutting head working on a sheet of material; illustrative machine',
      credit: {name: 'Cemrecan Yurtman / Unsplash', url: 'https://unsplash.com/photos/qk2i7n39-B0'},
      poster: 'A line on a screen becomes a line in the world. Precision leaves room for imagination.',
      description: 'Draw a shape, then watch a focused beam follow it. Laser cutters turn flat designs into parts, patterns, signs, and things that fit together.',
      ideas: ['Cut a layered sign or artwork', 'Create a slot-together prototype', 'Engrave a pattern into approved material'],
      note: 'The photo is an example, not our machine. Ask the club lead about training and approved materials for the SBHS cutters.'
    },
    {
      slug: 'sewing-machines', name: 'Sewing machines', category: 'TEXTILES', number: '03',
      headline: ['Make', 'a stitch.'], color: '#f7aaa6', background: '#6c747d',
      image: 'https://images.unsplash.com/photo-1603570707325-5d4d281ca924?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real sewing machine, shown as an example of the textile equipment',
      credit: {name: 'Serjan Midili / Unsplash', url: 'https://unsplash.com/photos/qdpxtU8gC_c'},
      poster: 'A patch. A repair. A piece of something personal. There is a story in every stitch.',
      description: 'Make something soft, wearable, or unexpected. Learn to join fabric and add your own details with the sewing machines in our room.',
      ideas: ['Sew a patch for the Makerspace door', 'Make a pouch, tote, or simple accessory', 'Repair or customize a piece of clothing'],
      note: 'No previous sewing experience needed. A little practice on scrap fabric is a good place to start.'
    },
    {
      slug: 'vinyl-cutter', name: 'Vinyl cutter', category: 'GRAPHICS', number: '04',
      headline: ['Stick', 'with it.'], color: '#d6f88c', background: '#709889',
      image: 'https://www.decocuir.com/cdn/shop/products/TA454-CricutMaker3_10.jpg?crop=center&v=1740569464',
      alt: 'An example Cricut cutting machine working with a sheet of gold vinyl',
      credit: {name: 'Example equipment / Decocuir', url: 'https://www.decocuir.com/en/products/cricut-maker-3'},
      poster: 'Your drawing. Your lettering. Your mark. Take an idea and put it somewhere.',
      description: 'Turn a graphic into a sticker. The vinyl cutter follows your design so you can make lettering, labels, and graphics with crisp edges.',
      ideas: ['Make a sticker from your own drawing', 'Create club graphics and equipment labels', 'Add lettering to a shared installation'],
      note: 'Simple shapes are great first projects. This photo is example equipment; our specific cutter is still to be photographed.'
    },
    {
      slug: 'raspberry-pis', name: 'Raspberry Pis', category: 'COMPUTING', number: '05',
      headline: ['Small', 'ideas?'], color: '#b6f6a0', background: '#192e22',
      image: 'https://cdn-shop.adafruit.com/970x728/1914-09.jpg',
      alt: 'A real Raspberry Pi Model B+ single-board computer',
      credit: {name: 'Example equipment / Adafruit', url: 'https://www.adafruit.com/product/1914'},
      poster: 'A small computer. A very big starting point. Give an idea a little intelligence.',
      description: 'A whole computer on a little board. Use a Raspberry Pi to explore code, connect a sensor, or run a small interactive project.',
      ideas: ['Program a responsive light or display', 'Build a simple sensor-based project', 'Experiment with an interactive art controller'],
      note: 'You don’t have to arrive knowing how to code. Start with one thing you want the computer to do.'
    },
    {
      slug: 'electronics', name: 'Electronics', category: 'ELECTRONICS', number: '06',
      headline: ['Spark', 'an idea.'], color: '#d1b1fa', background: '#233931',
      image: 'https://images.unsplash.com/photo-1684430598817-0c77ec7babfd?auto=format&fit=crop&w=1200&q=85',
      alt: 'A macro photograph of the components and tracks on a real circuit board',
      credit: {name: 'Ludovico Ceroseis / Unsplash', url: 'https://unsplash.com/photos/AEboEnOlpLc'},
      poster: 'Connections you can see. Possibilities you can’t see yet. Bring something to life.',
      description: 'Connect hardware with imagination. Explore the components and circuits that help a project light up, sense something, or respond to the world.',
      ideas: ['Build a simple LED circuit', 'Explore sensors for an interactive artwork', 'Prototype the electronics for a robot'],
      note: 'Work with the club lead on a suitable low-voltage first project and learn what each connection does.'
    },
    {
      slug: 'cnc-router', name: 'CNC router', category: 'FABRICATION', number: '07',
      headline: ['Carve', 'it out.'], color: '#f2b561', background: '#7c8077',
      image: 'https://www.sainsmart.com/cdn/shop/files/101-60-3030PU_1.webp?v=1770277705',
      alt: 'A real SainSmart desktop CNC router, shown as illustrative equipment',
      credit: {name: 'Example equipment / SainSmart', url: 'https://www.sainsmart.com/products/3030-prover-ultra'},
      poster: 'Start with a solid piece of material. Find the shape that is waiting inside.',
      description: 'A CNC router follows a digital path to carve or cut material. It’s a way to give a computer model texture, depth, and a place in the real world.',
      ideas: ['Carve a sign with depth and texture', 'Make parts for a larger prototype', 'Explore a relief pattern for the door'],
      note: 'Plan a project with the club lead and learn the machine setup before routing. The pictured router is an example.'
    },
    {
      slug: 'vr-headsets', name: 'VR headsets', category: 'IMMERSIVE DESIGN', number: '08',
      headline: ['Step', 'inside.'], color: '#dab0ed', background: '#655681',
      image: 'https://images.unsplash.com/photo-1666892937686-b5863f998162?auto=format&fit=crop&w=1200&q=85',
      alt: 'A person wearing a real virtual reality headset',
      credit: {name: 'Nappy / Unsplash', url: 'https://unsplash.com/photos/7VNueuvYERY'},
      poster: 'What if a sketch could become a place? Explore a different kind of canvas.',
      description: 'Explore a space from the inside. VR headsets let us think about scale, interaction, and experiences that extend beyond a flat screen.',
      ideas: ['Explore an immersive art experience', 'Think through an interactive room design', 'Try a virtual space as a creative reference'],
      note: 'Ask which headsets and experiences are available. Leave room around you and share what you discover.'
    },
    {
      slug: 'cad-design', name: 'CAD & 3D modeling', category: 'DIGITAL DESIGN', number: '09',
      headline: ['Shape', 'the idea.'], color: '#a6e1ff', background: '#34485f',
      image: 'https://images.unsplash.com/photo-1742971366169-6efb57949d56?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real 3D printer illustrating the physical outcome of CAD and 3D modeling',
      credit: {name: 'Jakub Żerdzicki / Unsplash', url: 'https://unsplash.com/photos/3xgqjn_etWQ'},
      poster: 'Sketch it. Measure it. Change it. A new dimension for the things you want to make.',
      description: 'Design before you print. CAD and 3D modeling tools help you create a digital version of an object, check its dimensions, and refine the shape.',
      ideas: ['Model a part that fits something you own', 'Design a printable sculpture or object', 'Create and revise a robotics component'],
      note: 'The image shows one possible outcome: a printer bringing a model into the world. Software details will be added later.'
    },
    {
      slug: 'hand-tools', name: 'Hand tools', category: 'THE WORKBENCH', number: '10',
      headline: ['Hands', 'on.'], color: '#e6d386', background: '#565950',
      image: 'https://images.unsplash.com/photo-1642796470393-4d62f7690485?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real workshop workbench with hand tools organized on the wall',
      credit: {name: 'Alaa Turkman / Unsplash', url: 'https://unsplash.com/photos/S8oAMD7boWk'},
      poster: 'Measure twice. Try something. The most useful tool is often the one in your hands.',
      description: 'The workbench essentials. Hand tools help with measuring, assembling, shaping, and the little adjustments that make a project come together.',
      ideas: ['Assemble and finish a prototype', 'Build a mixed-material object', 'Help make the Makerspace door'],
      note: 'Ask for an introduction to a tool you haven’t used. Put things back where the next maker can find them.'
    },
    {
      slug: 'power-tools', name: 'Power tools', category: 'THE WORKBENCH', number: '11',
      headline: ['Build', 'bigger.'], color: '#ffa285', background: '#7a7265',
      image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real red cordless drill on a wooden workshop surface',
      credit: {name: 'Quilia / Unsplash', url: 'https://unsplash.com/photos/CuDoRFyTkAQ'},
      poster: 'Make a connection. Build a structure. Give your next project something to stand on.',
      description: 'Bring more ambitious builds within reach. Power tools help us prepare material and assemble the structures that larger projects need.',
      ideas: ['Build a support for an installation', 'Prepare parts for a room project', 'Assemble a sturdy prototype'],
      note: 'Start with a supervised introduction. The exact power-tool inventory and training details will be added soon.'
    },
    {
      slug: 'our-room', name: 'Our room', category: 'OUR SHARED SPACE', number: '12',
      headline: ['Room', 'to make.'], color: '#b8f4c1', background: '#39483a',
      image: 'https://images.unsplash.com/photo-1642796470393-4d62f7690485?auto=format&fit=crop&w=1200&q=85',
      alt: 'An example makerspace workbench; photos of our dedicated SBHS room are coming later',
      credit: {name: 'Alaa Turkman / Unsplash', url: 'https://unsplash.com/photos/S8oAMD7boWk'},
      poster: 'An entire room for us. For experiments. For people. For things we haven’t imagined yet.',
      description: 'The most important thing in the collection isn’t a machine. It’s having a room of our own: somewhere to bring an idea, find a collaborator, and leave a little of ourselves behind.',
      ideas: ['Join the club during Golden Time', 'Collaborate on a future room installation', 'Bring an idea and see where it goes'],
      note: 'Golden Time meets on Tuesdays and Fridays during homeroom. Exact room and sign-up information is coming soon.'
    }
  ],
  projects: [
    {
      slug: 'projection-tour', title: 'Projection mapping tour', category: 'PROJECTION MAPPING',
      image: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Projection_mapping_in_Largo_Carlos_Amarante_2026_%285%29.jpg',
      alt: 'A real projection mapping installation on architecture, illustrating how projected light can transform a surface',
      credit: {name: 'Joseolgon / Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Projection_mapping_in_Largo_Carlos_Amarante_2026_(5).jpg', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'},
      description: 'Use multiple projectors to guide visitors around the Makerspace, with animations and interactive introductions to the equipment. Designed for events like Back to School Night.',
      plan: 'For events such as Back to School Night, we want to guide visitors through the Makerspace with projected prompts: “Look at this — here’s what it can do.” Each station becomes part of the experience.',
      detail: 'Map the surfaces, create the animations, then connect the scenes into a tour that makes the room feel alive.',
      tools: ['raspberry-pis', 'electronics', 'our-room']
    },
    {
      slug: 'the-door', title: 'The Makerspace door', category: 'MIXED MATERIALS',
      image: 'https://images.unsplash.com/photo-1564848534648-558dc1ef55c7?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real vintage blue sewing machine, representing one of the tools for making textile patches for the door',
      credit: {name: 'Juan Gomez / Unsplash', url: 'https://unsplash.com/photos/9L0zCCeD6J4'},
      description: 'Cover the door with sewn patches, 3D-printed parts, metal, and other materials made in the room. Each piece can come from a different student or tool.',
      plan: 'We want to remake the appearance of the Makerspace door with a collection of small pieces, each made by a different person or with a different process.',
      detail: 'Design a patch or part, try a material, and help work out how all the individual pieces fit together.',
      tools: ['sewing-machines', '3d-printers', 'cnc-router', 'hand-tools']
    },
    {
      slug: 'campus-art', title: '3D pen campus art', category: '3D PEN / CAMPUS ART',
      image: 'https://images.unsplash.com/photo-1742971366169-6efb57949d56?auto=format&fit=crop&w=1200&q=85',
      alt: 'A real 3D printer, illustrating the additive making technique behind the proposed 3D pen art project',
      credit: {name: 'Jakub Żerdzicki / Unsplash', url: 'https://unsplash.com/photos/3xgqjn_etWQ'},
      description: 'Use a 3D printing pen to trace selected cosmetic cracks on campus. A small decorative project that connects the Makerspace to the rest of SBHS.',
      plan: 'Our idea is to work with the school on an approved decorative project: tracing or filling suitable cosmetic cracks with 3D pen material. It’s a way to make our connection to campus visible.',
      detail: 'Choose a suitable surface with the school, test materials, and design an intervention that shows where the Makerspace has left its mark.',
      tools: ['3d-printers', 'hand-tools', 'our-room']
    },
    {
      slug: 'signatures', title: 'Wall of signatures', category: 'A CONTINUOUS COLLECTION',
      image: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Projection_mapping_in_Largo_Carlos_Amarante_2026_%285%29.jpg',
      alt: 'A real projection mapping installation illustrating the projected-light technique proposed for a growing wall of signatures',
      credit: {name: 'Joseolgon / Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Projection_mapping_in_Largo_Carlos_Amarante_2026_(5).jpg', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'},
      description: 'Collect signatures and designs from visitors and students, then layer them onto the wall with projection mapping. Keep adding to the collection as new people come through.',
      plan: 'We want to collect signatures and designs from people who visit the Makerspace or take a class. Projected onto the room, they become a growing artwork rather than a wall that ever feels finished.',
      detail: 'Build a digital collection, compose it into layers, and keep adding new contributions as the Makerspace community grows.',
      tools: ['raspberry-pis', 'electronics', 'our-room']
    }
  ],
  clubLeaders: [
    { role: 'President', name: null, image: null, description: 'Helps shape the club and brings our projects together.' },
    { role: 'Captain', name: null, image: null, description: 'Helps makers get started and keeps the builds moving.' },
    { role: 'Representative', name: null, image: null, description: 'Connects Makerspace with the wider SBHS community.' },
    { role: 'Liaisons', name: null, image: null, description: 'Connect our teams, ideas, and collaborators.' }
  ],
  // Stock-photo examples until students supply their own projects and maker credits.
  showcase: [
    { slug: 'printed-vase', title: 'A shape you can hold.', category: '3D PRINTING', maker: null,
      image: 'https://images.unsplash.com/photo-1703221561813-cdaa308cf9e7?auto=format&fit=crop&w=900&q=85',
      alt: 'A purple 3D-printed vase with a sculptural, folded surface',
      credit: { name: 'David Clode / Unsplash', url: 'https://unsplash.com/photos/C165O0AD8Ec' },
      description: 'A sculptural object, built one layer at a time.', tools: ['3d-printers', 'cad-design'] },
    { slug: 'handmade-bag', title: 'Carry your own idea.', category: 'TEXTILES', maker: null,
      image: 'https://images.unsplash.com/photo-1647425929500-702a24618f5d?auto=format&fit=crop&w=900&q=85',
      alt: 'A handmade fabric bag with embroidered details',
      credit: { name: 'Yellow Cactus / Unsplash', url: 'https://unsplash.com/photos/IMSHfJFuA3k' },
      description: 'Fabric, a few stitches, and something personal.', tools: ['sewing-machines', 'vinyl-cutter'] },
    { slug: 'wooden-hand', title: 'Give a material a life.', category: 'OBJECTS & ART', maker: null,
      image: 'https://images.unsplash.com/photo-1642177341669-819b8377456e?auto=format&fit=crop&w=900&q=85',
      alt: 'An articulated wooden hand holding a small wooden figure',
      credit: { name: 'Peter Heymans / Unsplash', url: 'https://unsplash.com/photos/Z7sO7xaTeac' },
      description: 'An everyday material becomes an unexpected character.', tools: ['laser-cutters', 'cnc-router', 'hand-tools', 'power-tools'] },
    { slug: 'moving-machine', title: 'A little more alive.', category: 'ROBOTICS & ELECTRONICS', maker: null,
      image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=85',
      alt: 'An example humanoid robot with an expressive face',
      credit: { name: 'Alex Knight / Unsplash', url: 'https://unsplash.com/photos/2EJCSULRwC8' },
      description: 'Shape, circuits, and code working together.', tools: ['raspberry-pis', 'electronics', 'vr-headsets', 'our-room'] }
  ],
  roboticsImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=85',
  roboticsCredit: {name: 'Alex Knight / Unsplash', url: 'https://unsplash.com/photos/2EJCSULRwC8'}
};
