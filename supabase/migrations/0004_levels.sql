-- Wordleaf: difficulty levels.
-- Every word gets a theme category. The host picks a level, which controls how close
-- the decoy card (and on level 3 the whole clover) stays to the themes on the board.
--   1 Easy:   random words; the decoy avoids every theme on the clover, so it stands out
--   2 Medium: random words; each decoy word shares a theme with a different leaf word
--   3 Hard:   clover and decoy are all drawn from ~3 themes, so everything looks alike

alter table public.words add column category text not null default 'misc';
create index on public.words (lang, category);

alter table public.rooms add column level int not null default 2 check (level between 1 and 3);

-- Word categories (generated; new words without a category fall into 'misc')
update public.words set category = 'fruit_veg' where lang = 'en' and word in ('Apple', 'Banana', 'Cherry', 'Lemon', 'Orange', 'Grape', 'Strawberry', 'Pear', 'Potato', 'Carrot', 'Onion', 'Garlic', 'Tomato', 'Mushroom', 'Pumpkin', 'Corn', 'Nut', 'Coconut', 'Peach', 'Melon', 'Pineapple');
update public.words set category = 'food' where lang = 'en' and word in ('Pepper', 'Salt', 'Sugar', 'Honey', 'Bread', 'Cheese', 'Butter', 'Milk', 'Egg', 'Chocolate', 'Cake', 'Soup', 'Pizza', 'Rice', 'Noodle', 'Sausage', 'Popcorn', 'Candy', 'Cookie', 'Jam', 'Oil', 'Vinegar', 'Mustard');
update public.words set category = 'kitchen' where lang = 'en' and word in ('Coffee', 'Tea', 'Wine', 'Beer', 'Kitchen', 'Bottle', 'Glass', 'Cup', 'Plate', 'Knife', 'Fork', 'Spoon', 'Pot', 'Oven', 'Fridge');
update public.words set category = 'weather' where lang = 'en' and word in ('Water', 'Ice', 'Fire', 'Smoke', 'Ash', 'Wind', 'Storm', 'Rain', 'Snow', 'Cloud', 'Rainbow', 'Lightning', 'Thunder', 'Fog', 'Steam', 'Bubble');
update public.words set category = 'space' where lang = 'en' and word in ('Sun', 'Moon', 'Star', 'Planet', 'Rocket', 'Sky', 'Alien', 'Astronaut', 'Earth', 'Space', 'Laser', 'Globe');
update public.words set category = 'landscape' where lang = 'en' and word in ('Mountain', 'Valley', 'River', 'Lake', 'Sea', 'Island', 'Beach', 'Sand', 'Desert', 'Stone', 'Cave', 'Volcano', 'Glacier', 'Wave', 'Mud', 'Dust', 'Jungle');
update public.words set category = 'plants' where lang = 'en' and word in ('Forest', 'Tree', 'Leaf', 'Root', 'Flower', 'Rose', 'Grass', 'Garden', 'Cactus', 'Palm');
update public.words set category = 'farm' where lang = 'en' and word in ('Dog', 'Cat', 'Mouse', 'Horse', 'Cow', 'Pig', 'Sheep', 'Goat', 'Chicken', 'Duck', 'Farm', 'Tractor', 'Wool');
update public.words set category = 'wild_animals' where lang = 'en' and word in ('Shell', 'Fox', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Elephant', 'Giraffe', 'Monkey', 'Snake', 'Frog', 'Turtle', 'Fish', 'Shark', 'Whale', 'Dolphin', 'Octopus', 'Crab', 'Horn', 'Tail', 'Claw', 'Paw', 'Zoo');
update public.words set category = 'birds_bugs' where lang = 'en' and word in ('Bird', 'Eagle', 'Owl', 'Penguin', 'Parrot', 'Bee', 'Ant', 'Spider', 'Butterfly', 'Snail', 'Feather', 'Nest', 'Web', 'Honeycomb', 'Wing');
update public.words set category = 'fantasy' where lang = 'en' and word in ('Dragon', 'Unicorn', 'Ghost', 'Witch', 'Wizard', 'Giant', 'Dwarf', 'Vampire', 'Magic', 'Mummy', 'Skeleton', 'Zombie', 'Monster', 'Angel', 'Devil', 'Heaven', 'Hell');
update public.words set category = 'castle_battle' where lang = 'en' and word in ('Pirate', 'Knight', 'King', 'Queen', 'Prince', 'Castle', 'Tower', 'Crown', 'Bomb', 'Sword', 'Shield', 'Arrow', 'Bow', 'Gun', 'Cannon', 'Flag', 'War', 'Peace');
update public.words set category = 'building' where lang = 'en' and word in ('Wall', 'Door', 'Window', 'Roof', 'Stairs', 'Garage', 'Key', 'Lock', 'Elevator', 'Escalator', 'Fence', 'Gate', 'Chimney', 'Balcony', 'Attic', 'Cellar');
update public.words set category = 'furniture' where lang = 'en' and word in ('Table', 'Chair', 'Bed', 'Pillow', 'Blanket', 'Mirror', 'Clock', 'Candle', 'Lamp', 'Sofa', 'Carpet', 'Curtain', 'Vase', 'Basket', 'Alarm');
update public.words set category = 'city' where lang = 'en' and word in ('Church', 'School', 'Hospital', 'Prison', 'Museum', 'Library', 'Cinema', 'Theater', 'Circus', 'Market', 'Bank', 'Hotel', 'Restaurant');
update public.words set category = 'landmarks' where lang = 'en' and word in ('Bridge', 'Airport', 'Station', 'Harbor', 'City', 'Village', 'Street', 'Pyramid', 'Temple', 'Park', 'Playground', 'Fountain', 'Well', 'Mill', 'Lighthouse', 'Tunnel');
update public.words set category = 'vehicles' where lang = 'en' and word in ('Car', 'Bus', 'Train', 'Plane', 'Ship', 'Boat', 'Bicycle', 'Helicopter', 'Submarine', 'Wheel', 'Engine', 'Anchor', 'Sail');
update public.words set category = 'travel' where lang = 'en' and word in ('Map', 'Compass', 'Tent', 'Backpack', 'Suitcase', 'Passport', 'Ticket', 'Holiday', 'Bag');
update public.words set category = 'tech' where lang = 'en' and word in ('Robot', 'Bulb', 'Battery', 'Cable', 'Phone', 'Computer', 'Screen', 'Camera', 'Radio', 'Television', 'Magnet', 'Microphone');
update public.words set category = 'paper_art' where lang = 'en' and word in ('Letter', 'Stamp', 'Book', 'Newspaper', 'Pen', 'Paper', 'Scissors', 'Glue', 'Paint', 'Brush', 'Film', 'Photo', 'Painting', 'Statue', 'Poem', 'Story', 'Envelope', 'Calendar');
update public.words set category = 'tools' where lang = 'en' and word in ('Box', 'Hammer', 'Nail', 'Saw', 'Ladder', 'Rope', 'Chain', 'Net', 'Hook', 'Needle', 'Thread', 'Iron', 'Wood', 'Plastic', 'Rubber');
update public.words set category = 'valuables' where lang = 'en' and word in ('Ring', 'Necklace', 'Diamond', 'Gold', 'Silver', 'Coin', 'Treasure', 'Money', 'Gift', 'Wallet');
update public.words set category = 'play' where lang = 'en' and word in ('Mask', 'Balloon', 'Kite', 'Toy', 'Doll', 'Ball', 'Dice', 'Puzzle', 'Game', 'Card', 'Chess');
update public.words set category = 'sports' where lang = 'en' and word in ('Football', 'Tennis', 'Golf', 'Ski', 'Swimming', 'Whistle', 'Victory', 'Race', 'Medal', 'Trophy', 'Goal', 'Referee', 'Team');
update public.words set category = 'music' where lang = 'en' and word in ('Dance', 'Music', 'Song', 'Guitar', 'Piano', 'Drum', 'Violin', 'Trumpet', 'Bell', 'Singer');
update public.words set category = 'feelings' where lang = 'en' and word in ('Dream', 'Nightmare', 'Secret', 'Luck', 'Love', 'Smile', 'Tear', 'Kiss', 'Hug', 'Joke', 'Question', 'Answer');
update public.words set category = 'body' where lang = 'en' and word in ('Heart', 'Brain', 'Eye', 'Ear', 'Nose', 'Mouth', 'Tooth', 'Tongue', 'Hair', 'Beard', 'Hand', 'Finger', 'Foot', 'Knee', 'Bone', 'Skin', 'Blood');
update public.words set category = 'time_events' where lang = 'en' and word in ('Shadow', 'Light', 'Night', 'Morning', 'Summer', 'Winter', 'Spring', 'Autumn', 'Birthday', 'Wedding', 'Christmas', 'Party', 'Time', 'Clockwork');
update public.words set category = 'people' where lang = 'en' and word in ('Doctor', 'Nurse', 'Teacher', 'Cook', 'Farmer', 'Soldier', 'Police', 'Thief', 'Detective', 'Judge', 'Clown', 'Artist', 'Scientist', 'Baby', 'Grandmother', 'Friend', 'Neighbor');
update public.words set category = 'clothing' where lang = 'en' and word in ('Hat', 'Shoe', 'Boot', 'Sock', 'Glove', 'Scarf', 'Dress', 'Shirt', 'Pocket', 'Button', 'Umbrella', 'Glasses');
update public.words set category = 'bathroom' where lang = 'en' and word in ('Soap', 'Towel', 'Bath', 'Shower', 'Toilet', 'Medicine', 'Bandage');
update public.words set category = 'fruit_veg' where lang = 'de' and word in ('Apfel', 'Banane', 'Kirsche', 'Zitrone', 'Orange', 'Traube', 'Erdbeere', 'Birne', 'Kartoffel', 'Karotte', 'Zwiebel', 'Knoblauch', 'Tomate', 'Pilz', 'Kürbis', 'Mais', 'Paprika', 'Nuss', 'Kokosnuss', 'Pfirsich', 'Melone', 'Ananas');
update public.words set category = 'food' where lang = 'de' and word in ('Pfeffer', 'Salz', 'Zucker', 'Honig', 'Brot', 'Käse', 'Butter', 'Milch', 'Ei', 'Schokolade', 'Kuchen', 'Suppe', 'Pizza', 'Reis', 'Nudel', 'Wurst', 'Popcorn', 'Bonbon', 'Keks', 'Marmelade', 'Öl', 'Essig', 'Senf');
update public.words set category = 'kitchen' where lang = 'de' and word in ('Kaffee', 'Tee', 'Wein', 'Bier', 'Küche', 'Flasche', 'Glas', 'Tasse', 'Teller', 'Messer', 'Gabel', 'Löffel', 'Topf', 'Ofen', 'Kühlschrank');
update public.words set category = 'weather' where lang = 'de' and word in ('Wasser', 'Eis', 'Feuer', 'Rauch', 'Asche', 'Wind', 'Sturm', 'Regen', 'Schnee', 'Wolke', 'Regenbogen', 'Blitz', 'Donner', 'Nebel', 'Dampf', 'Blase');
update public.words set category = 'space' where lang = 'de' and word in ('Sonne', 'Mond', 'Stern', 'Planet', 'Rakete', 'Himmel', 'Alien', 'Astronaut', 'Erde', 'Weltraum', 'Laser', 'Globus');
update public.words set category = 'landscape' where lang = 'de' and word in ('Berg', 'Tal', 'Fluss', 'See', 'Meer', 'Insel', 'Strand', 'Sand', 'Wüste', 'Stein', 'Höhle', 'Vulkan', 'Gletscher', 'Welle', 'Schlamm', 'Staub', 'Dschungel');
update public.words set category = 'plants' where lang = 'de' and word in ('Wald', 'Baum', 'Blatt', 'Wurzel', 'Blume', 'Rose', 'Gras', 'Garten', 'Kaktus', 'Palme');
update public.words set category = 'farm' where lang = 'de' and word in ('Hund', 'Katze', 'Maus', 'Pferd', 'Kuh', 'Schwein', 'Schaf', 'Ziege', 'Huhn', 'Ente', 'Bauernhof', 'Traktor', 'Wolle', 'Hof');
update public.words set category = 'wild_animals' where lang = 'de' and word in ('Muschel', 'Fuchs', 'Wolf', 'Bär', 'Löwe', 'Tiger', 'Elefant', 'Giraffe', 'Affe', 'Schlange', 'Frosch', 'Schildkröte', 'Fisch', 'Hai', 'Wal', 'Delfin', 'Krake', 'Krabbe', 'Horn', 'Schwanz', 'Kralle', 'Pfote', 'Zoo');
update public.words set category = 'birds_bugs' where lang = 'de' and word in ('Vogel', 'Adler', 'Eule', 'Pinguin', 'Papagei', 'Biene', 'Ameise', 'Spinne', 'Schmetterling', 'Schnecke', 'Feder', 'Nest', 'Wabe', 'Flügel');
update public.words set category = 'fantasy' where lang = 'de' and word in ('Drache', 'Einhorn', 'Geist', 'Hexe', 'Zauberer', 'Riese', 'Zwerg', 'Vampir', 'Magie', 'Mumie', 'Skelett', 'Zombie', 'Monster', 'Engel', 'Teufel', 'Paradies', 'Hölle');
update public.words set category = 'castle_battle' where lang = 'de' and word in ('Pirat', 'Ritter', 'König', 'Königin', 'Prinz', 'Burg', 'Turm', 'Krone', 'Bombe', 'Schwert', 'Schild', 'Pfeil', 'Bogen', 'Pistole', 'Kanone', 'Flagge', 'Krieg', 'Frieden');
update public.words set category = 'building' where lang = 'de' and word in ('Mauer', 'Tür', 'Fenster', 'Dach', 'Treppe', 'Garage', 'Schlüssel', 'Schloss', 'Aufzug', 'Rolltreppe', 'Zaun', 'Tor', 'Schornstein', 'Balkon', 'Dachboden', 'Keller');
update public.words set category = 'furniture' where lang = 'de' and word in ('Tisch', 'Stuhl', 'Bett', 'Kissen', 'Decke', 'Spiegel', 'Uhr', 'Kerze', 'Lampe', 'Sofa', 'Teppich', 'Vorhang', 'Vase', 'Korb', 'Wecker');
update public.words set category = 'city' where lang = 'de' and word in ('Kirche', 'Schule', 'Krankenhaus', 'Gefängnis', 'Museum', 'Bibliothek', 'Kino', 'Theater', 'Zirkus', 'Markt', 'Bank', 'Hotel', 'Restaurant');
update public.words set category = 'landmarks' where lang = 'de' and word in ('Brücke', 'Flughafen', 'Bahnhof', 'Hafen', 'Stadt', 'Dorf', 'Straße', 'Pyramide', 'Tempel', 'Park', 'Spielplatz', 'Brunnen', 'Quelle', 'Mühle', 'Leuchtturm', 'Tunnel');
update public.words set category = 'vehicles' where lang = 'de' and word in ('Auto', 'Bus', 'Zug', 'Flugzeug', 'Schiff', 'Boot', 'Fahrrad', 'Hubschrauber', 'U-Boot', 'Rad', 'Motor', 'Anker', 'Segel');
update public.words set category = 'travel' where lang = 'de' and word in ('Karte', 'Kompass', 'Zelt', 'Rucksack', 'Koffer', 'Reisepass', 'Ticket', 'Urlaub', 'Landkarte', 'Tüte');
update public.words set category = 'tech' where lang = 'de' and word in ('Roboter', 'Glühbirne', 'Batterie', 'Kabel', 'Telefon', 'Computer', 'Bildschirm', 'Kamera', 'Radio', 'Fernseher', 'Magnet', 'Mikrofon');
update public.words set category = 'paper_art' where lang = 'de' and word in ('Brief', 'Briefmarke', 'Buch', 'Zeitung', 'Stift', 'Papier', 'Schere', 'Kleber', 'Farbe', 'Pinsel', 'Film', 'Foto', 'Gemälde', 'Statue', 'Gedicht', 'Geschichte', 'Umschlag', 'Kalender');
update public.words set category = 'tools' where lang = 'de' and word in ('Kiste', 'Hammer', 'Nagel', 'Säge', 'Leiter', 'Seil', 'Kette', 'Netz', 'Haken', 'Nadel', 'Faden', 'Eisen', 'Holz', 'Plastik', 'Gummi');
update public.words set category = 'valuables' where lang = 'de' and word in ('Ring', 'Halskette', 'Diamant', 'Gold', 'Silber', 'Münze', 'Schatz', 'Geld', 'Geschenk', 'Geldbeutel');
update public.words set category = 'play' where lang = 'de' and word in ('Maske', 'Ballon', 'Drachen', 'Spielzeug', 'Puppe', 'Ball', 'Würfel', 'Puzzle', 'Spiel', 'Schach');
update public.words set category = 'sports' where lang = 'de' and word in ('Fußball', 'Tennis', 'Golf', 'Ski', 'Schwimmen', 'Pfeife', 'Sieg', 'Rennen', 'Medaille', 'Pokal', 'Schiedsrichter', 'Mannschaft');
update public.words set category = 'music' where lang = 'de' and word in ('Tanz', 'Musik', 'Lied', 'Gitarre', 'Klavier', 'Trommel', 'Geige', 'Trompete', 'Glocke', 'Sänger');
update public.words set category = 'feelings' where lang = 'de' and word in ('Traum', 'Albtraum', 'Geheimnis', 'Glück', 'Liebe', 'Lächeln', 'Träne', 'Kuss', 'Umarmung', 'Witz', 'Frage', 'Antwort');
update public.words set category = 'body' where lang = 'de' and word in ('Herz', 'Gehirn', 'Auge', 'Ohr', 'Nase', 'Mund', 'Zahn', 'Zunge', 'Haar', 'Bart', 'Hand', 'Finger', 'Fuß', 'Knie', 'Knochen', 'Haut', 'Blut');
update public.words set category = 'time_events' where lang = 'de' and word in ('Schatten', 'Licht', 'Nacht', 'Morgen', 'Sommer', 'Winter', 'Frühling', 'Herbst', 'Geburtstag', 'Hochzeit', 'Weihnachten', 'Party', 'Zeit', 'Uhrwerk', 'Feier');
update public.words set category = 'people' where lang = 'de' and word in ('Arzt', 'Pfleger', 'Lehrer', 'Koch', 'Bauer', 'Soldat', 'Polizei', 'Dieb', 'Detektiv', 'Richter', 'Clown', 'Künstler', 'Forscher', 'Baby', 'Oma', 'Freund', 'Nachbar');
update public.words set category = 'clothing' where lang = 'de' and word in ('Hut', 'Schuh', 'Stiefel', 'Socke', 'Handschuh', 'Schal', 'Kleid', 'Hemd', 'Tasche', 'Knopf', 'Regenschirm', 'Brille');
update public.words set category = 'bathroom' where lang = 'de' and word in ('Seife', 'Handtuch', 'Badewanne', 'Dusche', 'Toilette', 'Medizin', 'Verband');
update public.words set category = 'fruit_veg' where lang = 'fr' and word in ('Pomme', 'Banane', 'Cerise', 'Citron', 'Orange', 'Raisin', 'Fraise', 'Poire', 'Patate', 'Carotte', 'Oignon', 'Ail', 'Tomate', 'Champignon', 'Citrouille', 'Maïs', 'Poivron', 'Noix', 'Noix-de-coco', 'Pêche', 'Melon', 'Ananas');
update public.words set category = 'food' where lang = 'fr' and word in ('Poivre', 'Sel', 'Sucre', 'Miel', 'Pain', 'Fromage', 'Beurre', 'Lait', 'Œuf', 'Chocolat', 'Gâteau', 'Soupe', 'Pizza', 'Riz', 'Nouille', 'Saucisse', 'Pop-corn', 'Bonbon', 'Biscuit', 'Confiture', 'Huile', 'Vinaigre', 'Moutarde');
update public.words set category = 'kitchen' where lang = 'fr' and word in ('Café', 'Thé', 'Vin', 'Bière', 'Cuisine', 'Bouteille', 'Verre', 'Tasse', 'Assiette', 'Couteau', 'Fourchette', 'Cuillère', 'Marmite', 'Four', 'Frigo');
update public.words set category = 'weather' where lang = 'fr' and word in ('Eau', 'Glace', 'Feu', 'Fumée', 'Cendre', 'Vent', 'Tempête', 'Pluie', 'Neige', 'Nuage', 'Arc-en-ciel', 'Éclair', 'Tonnerre', 'Brouillard', 'Vapeur', 'Bulle');
update public.words set category = 'space' where lang = 'fr' and word in ('Soleil', 'Lune', 'Étoile', 'Planète', 'Fusée', 'Ciel', 'Extraterrestre', 'Astronaute', 'Terre', 'Espace', 'Laser', 'Globe');
update public.words set category = 'landscape' where lang = 'fr' and word in ('Montagne', 'Vallée', 'Rivière', 'Lac', 'Mer', 'Île', 'Plage', 'Sable', 'Désert', 'Pierre', 'Grotte', 'Volcan', 'Glacier', 'Vague', 'Boue', 'Poussière', 'Jungle');
update public.words set category = 'plants' where lang = 'fr' and word in ('Forêt', 'Arbre', 'Feuille', 'Racine', 'Fleur', 'Rose', 'Herbe', 'Jardin', 'Cactus', 'Palmier');
update public.words set category = 'farm' where lang = 'fr' and word in ('Chien', 'Chat', 'Souris', 'Cheval', 'Vache', 'Cochon', 'Mouton', 'Chèvre', 'Poule', 'Canard', 'Ferme', 'Tracteur', 'Laine');
update public.words set category = 'wild_animals' where lang = 'fr' and word in ('Coquillage', 'Renard', 'Loup', 'Ours', 'Lion', 'Tigre', 'Éléphant', 'Girafe', 'Singe', 'Serpent', 'Grenouille', 'Tortue', 'Poisson', 'Requin', 'Baleine', 'Dauphin', 'Pieuvre', 'Crabe', 'Corne', 'Queue', 'Griffe', 'Patte', 'Zoo');
update public.words set category = 'birds_bugs' where lang = 'fr' and word in ('Oiseau', 'Aigle', 'Hibou', 'Manchot', 'Perroquet', 'Abeille', 'Fourmi', 'Araignée', 'Papillon', 'Escargot', 'Plume', 'Nid', 'Toile', 'Alvéole', 'Aile');
update public.words set category = 'fantasy' where lang = 'fr' and word in ('Dragon', 'Licorne', 'Fantôme', 'Sorcière', 'Magicien', 'Géant', 'Nain', 'Vampire', 'Magie', 'Momie', 'Squelette', 'Zombie', 'Monstre', 'Ange', 'Diable', 'Paradis', 'Enfer');
update public.words set category = 'castle_battle' where lang = 'fr' and word in ('Pirate', 'Chevalier', 'Roi', 'Reine', 'Prince', 'Château', 'Tour', 'Couronne', 'Bombe', 'Épée', 'Bouclier', 'Flèche', 'Arc', 'Pistolet', 'Canon', 'Drapeau', 'Guerre', 'Paix');
update public.words set category = 'building' where lang = 'fr' and word in ('Mur', 'Porte', 'Fenêtre', 'Toit', 'Escalier', 'Garage', 'Clé', 'Serrure', 'Ascenseur', 'Escalator', 'Clôture', 'Portail', 'Cheminée', 'Balcon', 'Grenier', 'Cave');
update public.words set category = 'furniture' where lang = 'fr' and word in ('Table', 'Chaise', 'Lit', 'Oreiller', 'Couverture', 'Miroir', 'Horloge', 'Bougie', 'Lampe', 'Canapé', 'Tapis', 'Rideau', 'Vase', 'Panier', 'Réveil');
update public.words set category = 'city' where lang = 'fr' and word in ('Église', 'École', 'Hôpital', 'Prison', 'Musée', 'Bibliothèque', 'Cinéma', 'Théâtre', 'Cirque', 'Marché', 'Banque', 'Hôtel', 'Restaurant');
update public.words set category = 'landmarks' where lang = 'fr' and word in ('Pont', 'Aéroport', 'Gare', 'Port', 'Ville', 'Village', 'Rue', 'Pyramide', 'Temple', 'Parc', 'Aire', 'Fontaine', 'Source', 'Moulin', 'Phare', 'Tunnel');
update public.words set category = 'vehicles' where lang = 'fr' and word in ('Voiture', 'Bus', 'Train', 'Avion', 'Navire', 'Bateau', 'Vélo', 'Hélicoptère', 'Sous-marin', 'Roue', 'Moteur', 'Ancre', 'Voile');
update public.words set category = 'travel' where lang = 'fr' and word in ('Carte', 'Boussole', 'Tente', 'Sac', 'Valise', 'Passeport', 'Billet', 'Vacances', 'Plan', 'Sachet');
update public.words set category = 'tech' where lang = 'fr' and word in ('Robot', 'Ampoule', 'Pile', 'Câble', 'Téléphone', 'Ordinateur', 'Écran', 'Appareil', 'Radio', 'Télévision', 'Aimant', 'Micro');
update public.words set category = 'paper_art' where lang = 'fr' and word in ('Lettre', 'Timbre', 'Livre', 'Journal', 'Stylo', 'Papier', 'Ciseaux', 'Colle', 'Peinture', 'Pinceau', 'Film', 'Photo', 'Tableau', 'Statue', 'Poème', 'Histoire', 'Enveloppe', 'Calendrier');
update public.words set category = 'tools' where lang = 'fr' and word in ('Boîte', 'Marteau', 'Clou', 'Scie', 'Échelle', 'Corde', 'Chaîne', 'Filet', 'Crochet', 'Aiguille', 'Fil', 'Fer', 'Bois', 'Plastique', 'Caoutchouc');
update public.words set category = 'valuables' where lang = 'fr' and word in ('Bague', 'Collier', 'Diamant', 'Or', 'Argent', 'Pièce', 'Trésor', 'Monnaie', 'Cadeau', 'Portefeuille');
update public.words set category = 'play' where lang = 'fr' and word in ('Masque', 'Ballon', 'Cerf-volant', 'Jouet', 'Poupée', 'Balle', 'Dé', 'Puzzle', 'Jeu', 'Échecs');
update public.words set category = 'sports' where lang = 'fr' and word in ('Football', 'Tennis', 'Golf', 'Ski', 'Natation', 'Sifflet', 'Victoire', 'Course', 'Médaille', 'Trophée', 'But', 'Arbitre', 'Équipe');
update public.words set category = 'music' where lang = 'fr' and word in ('Danse', 'Musique', 'Chanson', 'Guitare', 'Piano', 'Tambour', 'Violon', 'Trompette', 'Cloche', 'Chanteur');
update public.words set category = 'feelings' where lang = 'fr' and word in ('Rêve', 'Cauchemar', 'Secret', 'Chance', 'Amour', 'Sourire', 'Larme', 'Bisou', 'Câlin', 'Blague', 'Question', 'Réponse');
update public.words set category = 'body' where lang = 'fr' and word in ('Cœur', 'Cerveau', 'Œil', 'Oreille', 'Nez', 'Bouche', 'Dent', 'Langue', 'Cheveu', 'Barbe', 'Main', 'Doigt', 'Pied', 'Genou', 'Os', 'Peau', 'Sang');
update public.words set category = 'time_events' where lang = 'fr' and word in ('Ombre', 'Lumière', 'Nuit', 'Matin', 'Été', 'Hiver', 'Printemps', 'Automne', 'Anniversaire', 'Mariage', 'Noël', 'Fête', 'Temps', 'Rouage', 'Soirée');
update public.words set category = 'people' where lang = 'fr' and word in ('Médecin', 'Infirmier', 'Professeur', 'Cuisinier', 'Fermier', 'Soldat', 'Police', 'Voleur', 'Détective', 'Juge', 'Clown', 'Artiste', 'Chercheur', 'Bébé', 'Mamie', 'Ami', 'Voisin');
update public.words set category = 'clothing' where lang = 'fr' and word in ('Chapeau', 'Chaussure', 'Botte', 'Chaussette', 'Gant', 'Écharpe', 'Robe', 'Chemise', 'Poche', 'Bouton', 'Parapluie', 'Lunettes');
update public.words set category = 'bathroom' where lang = 'fr' and word in ('Savon', 'Serviette', 'Baignoire', 'Douche', 'Toilettes', 'Médicament', 'Pansement');

-- Random unused words, optionally limited to (or excluding) some categories
create or replace function public._pick_words(
  p_lang text, p_n int, p_used text[], p_in text[] default null, p_not_in text[] default null
) returns text[]
language sql volatile set search_path = public as $$
  select coalesce(array_agg(word), '{}') from (
    select word from words
    where lang = p_lang and word <> all (p_used)
      and (p_in is null or category = any (p_in))
      and (p_not_in is null or category <> all (p_not_in))
    order by random() limit p_n
  ) s
$$;

-- 20 words for one clover: [1:16] are the four board cards in slot order, [17:20] the decoy.
-- p_rot holds the rotations of slots 0-3, needed to find the words that face a leaf.
create or replace function public._clover_words(p_lang text, p_level int, p_used text[], p_rot int[])
returns text[]
language plpgsql volatile set search_path = public as $$
declare
  v_board text[]; v_decoy text[] := '{}'; v_pool text[] := '{}'; v_cats text[] := '{}';
  v_leaf text[] := '{}'; c text; w text; s int; e int;
begin
  if p_level = 3 then
    -- At most 7 words per theme, so a clover spans about three themes
    while cardinality(v_pool) < 20 loop
      select category into c from words
      where lang = p_lang and word <> all (p_used || v_pool) and category <> all (v_cats)
      group by category order by random() limit 1;
      exit when c is null;
      v_cats := v_cats || c;
      v_pool := v_pool || _pick_words(p_lang, least(7, 20 - cardinality(v_pool)), p_used || v_pool, array[c]);
    end loop;
    select array_agg(x order by random()) into v_pool from unnest(v_pool) x;
    return v_pool;
  end if;

  v_board := _pick_words(p_lang, 16, p_used);
  if cardinality(v_board) < 16 then return v_board; end if;

  if p_level = 2 then
    -- Slot s faces the leaves on edges s and s-1; a card turned r shows words[(edge - r) mod 4]
    for s in 0..3 loop
      foreach e in array array[s, (s + 3) % 4] loop
        v_leaf := v_leaf || v_board[s * 4 + ((e - p_rot[s + 1]) % 4 + 4) % 4 + 1];
      end loop;
    end loop;
    for w in select x from unnest(v_leaf) x order by random() limit 4 loop
      v_decoy := v_decoy || _pick_words(p_lang, 1, p_used || v_board || v_decoy,
        array[(select category from words where lang = p_lang and word = w)]);
    end loop;
  else
    v_decoy := _pick_words(p_lang, 4, p_used || v_board, null,
      (select array_agg(distinct category) from words where lang = p_lang and word = any (v_board)));
  end if;
  -- Top up with any unused words if a theme ran out
  v_decoy := v_decoy || _pick_words(p_lang, 4 - cardinality(v_decoy), p_used || v_board || v_decoy);
  return v_board || v_decoy;
end $$;

revoke all on function public._pick_words(text, int, text[], text[], text[]) from public, anon, authenticated;
revoke all on function public._clover_words(text, int, text[], int[])       from public, anon, authenticated;

-- start_game gains p_level (null = keep the room's current level)
drop function public.start_game(text, text);

create function public.start_game(p_card_lang text, p_room text default 'main', p_level int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid; r rooms; n int; v_level int; v_used text[] := '{}'; v_words text[];
  v_rot int[]; v_roles int[]; p record; k int; v_card uuid;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  if r.status not in ('lobby', 'finished') then raise exception 'game_in_progress'; end if;
  if p_card_lang not in ('en', 'de', 'fr') then raise exception 'invalid_language'; end if;
  v_level := coalesce(p_level, r.level);
  if v_level not between 1 and 3 then raise exception 'invalid_level'; end if;

  select count(*) into n from room_players where room_id = p_room;
  if n < 2 or n > 10 then raise exception 'need_2_to_10_players'; end if;

  delete from clovers where room_id = p_room;

  for p in select user_id, name from room_players where room_id = p_room loop
    insert into clovers (room_id, owner_id, owner_name) values (p_room, p.user_id, p.name);
    select array_agg(floor(random() * 4)::int) into v_rot from generate_series(1, 4);
    v_words := _clover_words(p_card_lang, v_level, v_used, v_rot);
    if cardinality(v_words) < 20 then raise exception 'not_enough_words'; end if;
    v_used := v_used || v_words;
    -- roles 0-3 = board slots, 4 = decoy; shuffled so insert order leaks nothing
    select array_agg(x order by random()) into v_roles from unnest(array[0, 1, 2, 3, 4]) x;
    foreach k in array v_roles loop
      insert into cards (room_id, owner_id, words, tray_order)
      values (p_room, p.user_id, v_words[k * 4 + 1 : k * 4 + 4], floor(random() * 1000000)::int)
      returning id into v_card;
      insert into solutions (card_id, room_id, owner_id, slot, rotation)
      values (v_card, p_room, p.user_id,
              case when k = 4 then null else k end,
              case when k = 4 then 0 else v_rot[k + 1] end);
    end loop;
  end loop;

  update rooms set
    status = 'writing', card_lang = p_card_lang, level = v_level, turn_order = '{}', current_turn = 0,
    attempt = 1, revealing = false, guess_state = '{}', locked_slots = '{}',
    score = 0, updated_at = now()
  where id = p_room;
end $$;

grant execute on function public.start_game(text, text, int) to authenticated;
revoke execute on function public.start_game(text, text, int) from public, anon;
