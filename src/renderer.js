// RoarPlay's page: the queue, the player, the clock, the keys, the subtitles, the sound, the picture, the info.
// What the window cannot play itself comes from ffmpeg through rp://play/<id> (main.js), in pieces (Media Source).
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------- Settings, kept on this computer ----------
const DEFAULTS = {
  lang: 'en', autoUpdate: true, atEnd: 'next', clockMode: 'tc', volume: 1, muted: false, side: true, sideTab: 'queue',
  speed: 1, keepPitch: true, subSize: 'm', subDelay: 0, subOn: true,
  fitMode: 'contain', aspect: 0, zoom: 1, rot: 0, flipH: false, flipV: false, brightness: 1, contrast: 1, saturation: 1, followPic: true, onTop: false,
  playQuality: 1080, brawLook: '709', seqFps: 24, resume: true, snapFormat: 'png', snapWhere: 'beside', snapDir: '',
  chan: 'stereo', audDelay: 0, outDevice: '', eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], shuffle: false,
  scopeKind: 'waveform', keyTicks: false, lutFile: '', lutMix: 1, cmpMode: 'wipe', quiet: true,
  keepQueue: true, autoplayOpen: true, jumpSecs: 1, keepLook: true, startVolume: 'keep', keepSound: true, subAuto: true, subLang: '', idleSecs: 2, sideStart: true, bezelTop: false, snapName: 'tc',
};
let S = { ...DEFAULTS };
try { S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('settings') || '{}') }; } catch {}
const save = () => { try { localStorage.setItem('settings', JSON.stringify(S)); } catch {} };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const fetchStore = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

// ---------- Words: English is the key, Greek the choice (as in the other Roar apps) ----------
const EL = {
  'Restart to update': 'Επανεκκίνηση για ενημέρωση', 'Open': 'Άνοιγμα', 'Queue and info': 'Λίστα και πληροφορίες', 'Settings': 'Ρυθμίσεις',
  'Open a web address (Cmd/Ctrl+U)': 'Άνοιγμα διεύθυνσης web (Cmd/Ctrl+U)', 'Open a web address': 'Άνοιγμα διεύθυνσης web',
  'A direct link to a video or sound file (http or https). Pages like YouTube are not links to files: RoarGrab saves those.': 'Ένας άμεσος σύνδεσμος σε αρχείο βίντεο ή ήχου (http ή https). Σελίδες όπως το YouTube δεν είναι σύνδεσμοι αρχείων: αυτές τις κατεβάζει το RoarGrab.',
  'Plays <b>everything</b>.': 'Παίζει <b>τα πάντα</b>.',
  'Every video and every sound: ProRes, DNxHR, MXF, MKV, AVI, WAV, FLAC, AC3, image sequences and the rest. All on your own computer.': 'Κάθε βίντεο και κάθε ήχος: ProRes, DNxHR, MXF, MKV, AVI, WAV, FLAC, AC3, image sequences και όλα τα υπόλοιπα. Όλα στον δικό σου υπολογιστή.',
  'Choose files': 'Επιλογή αρχείων', 'or drop files and folders anywhere': 'ή ρίξε αρχεία και φακέλους οπουδήποτε', 'Drop to play': 'Άφησέ τα για να παίξουν',
  'Timecode, time or frames': 'Timecode, χρόνος ή καρέ', 'Mark in (I)': 'Σημείο In (I)', 'Mark out (O)': 'Σημείο Out (O)', 'Clear in and out (Alt+X)': 'Καθάρισε In και Out (Alt+X)',
  'In: click to clear': 'In: κλικ για να καθαρίσει', 'Out: click to clear': 'Out: κλικ για να καθαρίσει',
  'One frame back (Left arrow)': 'Ένα καρέ πίσω (αριστερό βέλος)', 'One frame forward (Right arrow)': 'Ένα καρέ μπροστά (δεξί βέλος)',
  'Back, faster each press (J)': 'Πίσω, πιο γρήγορα σε κάθε πάτημα (J)', 'Forward, faster each press (L)': 'Μπροστά, πιο γρήγορα σε κάθε πάτημα (L)',
  'Play or pause (Space)': 'Παίξε ή σταμάτα (Space)', 'Loop (Cmd/Ctrl+L)': 'Επανάληψη (Cmd/Ctrl+L)', 'Save this frame as a picture (Cmd/Ctrl+Shift+S)': 'Αποθήκευση του καρέ σε εικόνα (Cmd/Ctrl+Shift+S)',
  'Sound on or off (M)': 'Ήχος ναι ή όχι (M)', 'Volume': 'Ένταση', 'Full screen (F)': 'Πλήρης οθόνη (F)', 'Speed': 'Ταχύτητα', 'Subtitles (S)': 'Υπότιτλοι (S)', 'Subtitles': 'Υπότιτλοι',
  'Picture: frame, aspect, look': 'Εικόνα: κάδρο, αναλογία, εμφάνιση', 'Picture': 'Εικόνα', 'Sound: tracks, equalizer, output': 'Ήχος: κανάλια, equalizer, έξοδος', 'Sound': 'Ήχος',
  'Picture in picture (P)': 'Εικόνα μέσα σε εικόνα (P)', 'Small bezel: only the picture (B)': 'Μικρό bezel: μόνο η εικόνα (B)', 'Back to the full window (B)': 'Πίσω στο κανονικό παράθυρο (B)', 'Always on top': 'Πάντα μπροστά',
  'Keep the voices\' pitch': 'Οι φωνές κρατούν τον τόνο τους', 'Subtitle file…': 'Αρχείο υποτίτλων…', 'Size': 'Μέγεθος', 'Small': 'Μικρό', 'Normal': 'Κανονικό', 'Large': 'Μεγάλο', 'Delay': 'Καθυστέρηση',
  'Off': 'Όχι', 'None in the file or beside it.': 'Κανένας στο αρχείο ή δίπλα του.', 'in the file': 'στο αρχείο', 'bitmap, cannot be shown': 'εικόνα, δεν δείχνεται', 'Could not read the subtitles': 'Δεν διαβάστηκαν οι υπότιτλοι',
  'Frame': 'Κάδρο', 'Fit': 'Ολόκληρο', 'Fill': 'Γέμισμα', 'Aspect': 'Αναλογία', 'Zoom': 'Ζουμ', 'Turn': 'Στροφή', 'Mirror': 'Καθρέφτης', 'Upside down': 'Ανάποδα',
  'Brightness': 'Φωτεινότητα', 'Contrast': 'Αντίθεση', 'Saturation': 'Κορεσμός', 'Reset the picture': 'Επαναφορά εικόνας', 'Window takes the picture\'s shape': 'Το παράθυρο παίρνει το σχήμα της εικόνας',
  'On opening, and when you resize it.': 'Στο άνοιγμα, και όταν το μεγαλώνεις ή το μικραίνεις.', 'Stays over the other windows.': 'Μένει πάνω από τα άλλα παράθυρα.',
  'Hear': 'Ακούς', 'Stereo': 'Στέρεο', 'Left': 'Αριστερό', 'Right': 'Δεξί', 'Mono': 'Μονό', 'Swapped': 'Ανάποδα', 'Output': 'Έξοδος', 'Equalizer': 'Equalizer', 'Flat': 'Επίπεδο', 'Voice': 'Φωνή', 'Bass': 'Μπάσα', 'Bright': 'Φωτεινό',
  'System default': 'Του συστήματος', 'Sound track {n}': 'Κανάλι ήχου {n}',
  'Queue': 'Λίστα', 'Info': 'Πληροφορίες', 'Drop files or folders to line them up.': 'Ρίξε αρχεία ή φακέλους για να μπουν στη σειρά.', 'Add': 'Προσθήκη', 'Clear': 'Καθαρισμός', 'Shuffle': 'Τυχαία σειρά', 'Save the list as M3U': 'Αποθήκευση της λίστας σε M3U',
  'Copy all': 'Αντιγραφή όλων', 'Show in the folder': 'Εμφάνιση στον φάκελο', 'Copied': 'Αντιγράφηκε',
  'Language': 'Γλώσσα', 'The words of the app': 'Οι λέξεις της εφαρμογής', 'Playing': 'Αναπαραγωγή', 'When a file ends': 'Όταν τελειώνει ένα αρχείο',
  'Stop': 'Σταματά', 'Next': 'Επόμενο', 'Repeat': 'Ξανά', 'The clock shows': 'Το ρολόι δείχνει', 'Timecode': 'Timecode', 'Time': 'Χρόνο', 'Frames': 'Καρέ',
  'Picture made on the fly': 'Εικόνα που φτιάχνεται επιτόπου', 'ProRes, DNxHR, MXF and the rest are made H.264 while they play. 1080p is smooth on every computer; Full keeps the size and asks much more of it.': 'ProRes, DNxHR, MXF και τα υπόλοιπα γίνονται H.264 την ώρα που παίζουν. Το 1080p είναι ομαλό σε κάθε υπολογιστή· το Full κρατά το μέγεθος και του ζητά πολύ περισσότερα.',
  'Full': 'Πλήρες', 'Blackmagic RAW colour': 'Χρώμα Blackmagic RAW', 'Rec.709 shows the clip as a finished picture; the camera\'s LUT is the one it recorded into the clip; As shot keeps the camera\'s setting (Film is flat, for grading).': 'Το Rec.709 δείχνει το κλιπ σαν τελειωμένη εικόνα· το LUT της κάμερας είναι αυτό που έγραψε μέσα στο κλιπ· το Όπως τραβήχτηκε κρατά τη ρύθμιση της κάμερας (το Film είναι επίπεδο, για grading).', 'Camera LUT': 'LUT κάμερας', 'As shot': 'Όπως τραβήχτηκε', 'Image sequences play at': 'Τα image sequences παίζουν σε', 'Go on where you left off': 'Συνέχισε από εκεί που έμεινες', 'A file you had stopped in the middle opens there again.': 'Ένα αρχείο που σταμάτησες στη μέση ανοίγει πάλι εκεί.',
  'Window': 'Παράθυρο', 'Saved frames': 'Αποθηκευμένα καρέ', 'Format': 'Μορφή', 'Saved to': 'Αποθήκευση σε', 'Beside the file': 'Δίπλα στο αρχείο', 'Desktop': 'Επιφάνεια εργασίας', 'A folder…': 'Σε φάκελο…',
  'Open with RoarPlay': 'Άνοιγμα με το RoarPlay', 'Double-clicking a file opens it in RoarPlay': 'Το διπλό κλικ σε αρχείο το ανοίγει στο RoarPlay', 'Video': 'Βίντεο',
  'RoarPlay now opens {n} kinds of file.': 'Το RoarPlay ανοίγει τώρα {n} είδη αρχείων.', 'Pick RoarPlay in the window that opened.': 'Διάλεξε το RoarPlay στο παράθυρο που άνοιξε.', 'It could not be set': 'Δεν ορίστηκε',
  'Updates': 'Ενημερώσεις', 'Check now': 'Έλεγχος τώρα', 'Update by itself': 'Ενημέρωση μόνο του',
  'Looks for a new version every two hours, brings it in the background and puts it in when RoarPlay closes.': 'Ψάχνει νέα έκδοση κάθε δύο ώρες, τη φέρνει στο παρασκήνιο και τη βάζει όταν κλείσει το RoarPlay.',
  'Keys': 'Πλήκτρα', 'Close': 'Κλείσιμο', 'Cancel': 'Ακύρωση',
  'Looking for a new version…': 'Ψάχνει νέα έκδοση…', 'Bringing {v}: {p}%': 'Φέρνει την {v}: {p}%', '{v} is ready: restart to put it in.': 'Η {v} είναι έτοιμη: κάνε επανεκκίνηση για να μπει.',
  'Could not look just now ({e}). It tries again by itself.': 'Δεν μπόρεσε να ψάξει τώρα ({e}). Θα ξαναδοκιμάσει μόνο του.', 'Up to date · looked at {time}': 'Ενημερωμένο · έλεγχος στις {time}',
  'Up to date. It looks by itself.': 'Ενημερωμένο. Ψάχνει μόνο του.', 'Up to date.': 'Ενημερωμένο.',
  'Plays as it is': 'Παίζει όπως είναι', 'Sound made AAC while it plays': 'Ο ήχος γίνεται AAC την ώρα που παίζει', 'Picture made H.264 while it plays': 'Η εικόνα γίνεται H.264 την ώρα που παίζει',
  'Sound made FLAC while it plays': 'Ο ήχος γίνεται FLAC την ώρα που παίζει',
  'File': 'Αρχείο', 'Wrapper': 'Περιτύλιγμα', 'Length': 'Διάρκεια', 'Bitrate': 'Bitrate', 'Starts at': 'Ξεκινά από', 'Created': 'Δημιουργία', 'Modified': 'Τροποποίηση', 'Where': 'Πού',
  'Codec': 'Codec', 'Rate': 'Ρυθμός', 'Colour': 'Χρώμα', 'interlaced': 'πεπλεγμένο', 'Title': 'Τίτλος', 'Chapters': 'Κεφάλαια', 'Chapter {n}': 'Κεφάλαιο {n}',
  'Video stream': 'Ροή εικόνας', 'Sound stream': 'Ροή ήχου', 'Subtitle stream': 'Ροή υποτίτλων', 'Data stream': 'Ροή δεδομένων', 'Attachment': 'Συνημμένο', 'Stream': 'Ροή', 'Flags': 'Σημάδια', 'Side data': 'Πρόσθετα',
  'Sample format': 'Μορφή δείγματος', 'Pixel format': 'Μορφή pixel', 'Range': 'Εύρος', 'Primaries': 'Primaries', 'Transfer': 'Transfer', 'Matrix': 'Matrix', 'Pixel aspect': 'Αναλογία pixel', 'Display aspect': 'Αναλογία εικόνας',
  'Time base': 'Βάση χρόνου', 'Frame rate (tbr)': 'Ρυθμός καρέ (tbr)', 'Sequence': 'Sequence', '{n} frames from {s}, at {f} fps': '{n} καρέ από το {s}, σε {f} fps', 'Everything ffmpeg says': 'Όλα όσα λέει το ffmpeg', 'Nothing open yet.': 'Τίποτα ανοιχτό ακόμα.',
  'This file cannot be played here': 'Αυτό το αρχείο δεν παίζει εδώ', '{f} is opened by {app}.': 'Το {f} το ανοίγει το {app}.',
  'This file could not be played': 'Αυτό το αρχείο δεν έπαιξε', 'It may be damaged or not a video or sound file.': 'Μπορεί να είναι χαλασμένο ή να μην είναι αρχείο βίντεο ή ήχου.',
  '{n} left out, not video or sound: {names}': '{n} έμειναν έξω, δεν είναι βίντεο ή ήχος: {names}',
  'Saved {name}': 'Σώθηκε το {name}', 'Show': 'Δείξε', 'The frame could not be saved': 'Το καρέ δεν σώθηκε', 'The list was saved': 'Η λίστα σώθηκε',
  'Play, pause': 'Παίξε, σταμάτα', 'Back, forward, faster each press; K stops': 'Πίσω, μπροστά, πιο γρήγορα σε κάθε πάτημα· το K σταματά',
  'Hold K with J or L: one frame': 'Κράτα το K με J ή L: ένα καρέ', 'One frame back or forward': 'Ένα καρέ πίσω ή μπροστά', 'One second back or forward': 'Ένα δευτερόλεπτο πίσω ή μπροστά',
  'Start, end': 'Αρχή, τέλος', 'Mark in, mark out': 'Σημείο In, σημείο Out', 'Go to in, go to out': 'Πήγαινε στο In, στο Out', 'Clear in and out': 'Καθάρισε In και Out',
  'Play from in to out': 'Παίξε από το In ως το Out', 'Loop': 'Επανάληψη', 'Previous file, next file': 'Προηγούμενο, επόμενο αρχείο', 'Previous chapter, next chapter': 'Προηγούμενο, επόμενο κεφάλαιο', 'Volume up, down': 'Ένταση πάνω, κάτω',
  'Sound on or off': 'Ήχος ναι ή όχι', 'Full screen': 'Πλήρης οθόνη', 'Small bezel': 'Μικρό bezel', 'Picture in picture': 'Εικόνα μέσα σε εικόνα', 'Subtitles on or off': 'Υπότιτλοι ναι ή όχι', 'Slower, faster': 'Πιο αργά, πιο γρήγορα', 'Normal speed': 'Κανονική ταχύτητα',
  'Save the frame as a picture': 'Το καρέ σε εικόνα', 'Open files': 'Άνοιγμα αρχείων', 'Open a web address': 'Άνοιγμα διεύθυνσης web',
  'Scopes': 'Scopes', 'Notes': 'Σημειώσεις', 'Peak': 'Peak', 'Start the integrated loudness again': 'Ξεκίνα πάλι το integrated loudness', 'Waveform': 'Waveform', 'Vector': 'Vector', 'Histogram': 'Ιστόγραμμα',
  'Keyframes on the bar': 'Keyframes στη μπάρα', 'Read the packets': 'Διάβασε τα πακέτα', 'QC report': 'Αναφορά QC', 'Check the file': 'Έλεγξε το αρχείο', 'Save': 'Αποθήκευση',
  'Integrated': 'Integrated', 'Loudness range': 'Εύρος (LRA)', 'True peak': 'True peak', 'Keyframes': 'Keyframes', 'GOP': 'GOP',
  'Nothing found: no black, no frozen picture, no silence, no missing frames, no decode errors.': 'Δεν βρέθηκε τίποτα: ούτε μαύρο, ούτε παγωμένη εικόνα, ούτε σιωπή, ούτε χαμένα καρέ, ούτε σφάλματα αποκωδικοποίησης.',
  'Black': 'Μαύρο', 'Frozen': 'Παγωμένο', 'Silence': 'Σιωπή', 'Decode error': 'Σφάλμα αποκωδικοποίησης', 'Missing frames': 'Χαμένα καρέ',
  'Rating': 'Βαθμολογία', 'Markers': 'Markers', 'N adds one at the frame on screen': 'Το N βάζει έναν στο καρέ που βλέπεις', 'No markers yet.': 'Κανένας marker ακόμα.',
  'Choose a .cube…': 'Διάλεξε ένα .cube…', 'LUT amount': 'Ποσότητα LUT', 'Compare': 'Σύγκριση', 'Second file…': 'Δεύτερο αρχείο…', 'Wipe': 'Wipe', 'Side by side': 'Δίπλα δίπλα', 'The second file cannot be played here': 'Το δεύτερο αρχείο δεν παίζει εδώ',
  'Open files (Cmd/Ctrl+O)': 'Άνοιγμα αρχείων (Cmd/Ctrl+O)', 'More tools': 'Περισσότερα εργαλεία', 'Only the picture while it plays': 'Μόνο η εικόνα όσο παίζει',
  'The controls fade when the mouse rests, and come back when it moves.': 'Τα κουμπιά σβήνουν όταν ηρεμεί το ποντίκι και γυρίζουν όταν κουνηθεί.',
  'Tick the kinds you want, then Apply once. The Mac asks you to confirm each kind, so tick only what you need.': 'Τσέκαρε τα είδη που θες και πάτα Apply μία φορά. Το Mac ζητά επιβεβαίωση για κάθε είδος, γι\' αυτό τσέκαρε μόνο όσα χρειάζεσαι.',
  'all': 'όλα', 'none': 'κανένα', 'Apply': 'Εφαρμογή', 'Check': 'Έλεγχος', 'General': 'Γενικά', 'At start': 'Στην εκκίνηση',
  'Keep the list between sessions': 'Κράτα τη λίστα από φορά σε φορά', 'The files you had lined up are there again when RoarPlay opens.': 'Τα αρχεία που είχες στη σειρά είναι εκεί όταν ανοίγει το RoarPlay.',
  'Play a file as soon as it opens': 'Παίξε το αρχείο μόλις ανοίξει', 'Off: it opens on its first frame and waits.': 'Κλειστό: ανοίγει στο πρώτο καρέ και περιμένει.',
  'Shift with the arrows jumps': 'Shift με τα βελάκια πηδά', 'Keep the voices\' pitch at other speeds': 'Οι φωνές κρατούν τον τόνο τους στις άλλες ταχύτητες', 'Made on the fly': 'Επιτόπου',
  'On opening, and when you resize it. An aspect chosen in Picture reshapes it too.': 'Στο άνοιγμα και όταν το μεγαλώνεις. Μια αναλογία από το Picture του αλλάζει κι αυτή το σχήμα.',
  'A new file opens': 'Ένα νέο αρχείο ανοίγει', 'Keep the look from file to file': 'Κράτα την εμφάνιση από αρχείο σε αρχείο',
  'Aspect, zoom, turn, brightness, contrast, saturation and the LUT stay as you set them. Off: every file opens clean.': 'Αναλογία, ζουμ, στροφή, φωτεινότητα, αντίθεση, κορεσμός και LUT μένουν όπως τα έβαλες. Κλειστό: κάθε αρχείο ανοίγει καθαρό.',
  'Volume at start': 'Ένταση στην εκκίνηση', 'As left': 'Όπως έμεινε', 'Keep the equalizer and what you hear from file to file': 'Κράτα equalizer και κανάλια από αρχείο σε αρχείο', 'Off: every file opens stereo and flat.': 'Κλειστό: κάθε αρχείο ανοίγει στέρεο και επίπεδο.',
  'Show subtitles by themselves': 'Δείξε υπότιτλους μόνοι τους', 'The first track in the file, or the first file beside it.': 'Το πρώτο κανάλι στο αρχείο, ή το πρώτο αρχείο δίπλα του.', 'Preferred language': 'Προτιμώμενη γλώσσα',
  'Two letters, as in Film.el.srt: el, en, fr…': 'Δύο γράμματα, όπως στο Film.el.srt: el, en, fr…', 'They fade after': 'Σβήνουν μετά από', 'The side open at start': 'Το πλάι ανοιχτό στην εκκίνηση',
  'Queue, Info, Scopes and Notes shown when RoarPlay opens.': 'Λίστα, Πληροφορίες, Scopes και Σημειώσεις φαίνονται όταν ανοίγει το RoarPlay.', 'The small bezel always on top': 'Το μικρό bezel πάντα μπροστά',
  'Named with': 'Όνομα με', 'Frame number': 'Αριθμό καρέ', 'Kinds': 'Είδη',
  'Turn on the groups you want and press Apply once. The Mac asks you to confirm each kind it does not know yet; RoarPlay asks first for the general kinds (two questions), then only for what is still missing.': 'Άνοιξε τις ομάδες που θες και πάτα Apply μία φορά. Το Mac ζητά επιβεβαίωση για κάθε είδος που δεν ξέρει ακόμα· το RoarPlay ζητά πρώτα τα γενικά είδη (δύο ερωτήσεις) και μετά μόνο ό,τι λείπει.',
  'Common video': 'Συνηθισμένο βίντεο', 'Camera and broadcast': 'Κάμερα και τηλεόραση', 'Web and old video': 'Web και παλιό βίντεο', 'Raw picture streams': 'Σκέτες ροές εικόνας', 'Music': 'Μουσική', 'Studio sound': 'Ήχος στούντιο', 'Cinema sound': 'Ήχος κινηματογράφου', 'Other sound': 'Άλλος ήχος',
  'RoarPlay now opens {n} of the {m} kinds you chose.': 'Το RoarPlay ανοίγει τώρα {n} από τα {m} είδη που διάλεξες.',
  'Centre only': 'Μόνο το κέντρο', 'Surrounds only': 'Μόνο τα surround', 'Add a marker': 'Βάλε marker', 'Rating 1 to 5': 'Βαθμολογία 1 ως 5',
};
const t = (en, vars = {}) => {
  let s = (S.lang === 'el' && EL[en]) || en;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
};
function applyLang() {
  document.documentElement.lang = S.lang;
  for (const el of $$('[data-i18n]')) { el.dataset.en ??= el.textContent; el.textContent = t(el.dataset.en); }
  for (const el of $$('[data-i18n-html]')) { el.dataset.en ??= el.innerHTML; el.innerHTML = t(el.dataset.en); }
  for (const el of $$('[data-i18n-label]')) { const k = el.dataset.i18nLabel; el.setAttribute('aria-label', t(k)); el.title = t(k); }
  drawKeys();
  if (cur) { drawFacts(); drawSubsList(); drawTracks(); }
  drawQueue(); drawDevices(); showSnapDir(); if (typeof drawGroups === 'function') drawGroups();
  placeLenses();
}

// ---------- Formatting ----------
const fmtSize = (b) => { if (!b) return ''; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return `${b.toFixed(i > 1 ? 1 : 0)} ${u[i]}`; };
const fmtRate = (b) => (b ? (b >= 1e6 ? `${(b / 1e6).toFixed(b >= 1e7 ? 0 : 1)} Mb/s` : `${Math.round(b / 1000)} kb/s`) : '');
const pad = (n, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
function fmtClock(s) {
  s = Math.max(0, s || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${pad(m)}` : `${m}`) + `:${pad(sec)}`;
}
const fmtTime = (s) => { s = Math.max(0, s || 0); const ms = Math.floor((s % 1) * 1000); return `${Math.floor(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}.${pad(ms, 3)}`; };
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString(S.lang === 'el' ? 'el-GR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Timecode: SMPTE, drop frame for 29.97 and 59.94 when the file says so (01:00:00;00) ----------
const nominal = (fps) => Math.round(fps || 25);
const isDrop = (fps, base) => /;/.test(base || '') && Math.abs(fps * 1.001 - Math.round(fps * 1.001)) < 0.01 && [30, 60].includes(Math.round(fps * 1.001));
function tcToFrames(tc, fps, drop) {
  const m = /(\d+):(\d+):(\d+)[:;.](\d+)/.exec(tc || '');
  if (!m) return 0;
  const n = nominal(fps), [h, mi, s, f] = m.slice(1).map(Number);
  let frames = ((h * 60 + mi) * 60 + s) * n + f;
  if (drop) { const d = n === 60 ? 4 : 2; const mins = h * 60 + mi; frames -= d * (mins - Math.floor(mins / 10)); }
  return frames;
}
function framesToTc(frames, fps, drop) {
  const n = nominal(fps);
  frames = Math.max(0, Math.floor(frames));
  if (drop) {
    const d = n === 60 ? 4 : 2, per10 = n * 600 - d * 9, per1 = n * 60 - d;
    const tens = Math.floor(frames / per10), rem = frames % per10;
    frames += d * 9 * tens + (rem > d ? d * Math.floor((rem - d) / per1) : 0);
  }
  const f = frames % n, s = Math.floor(frames / n) % 60, m = Math.floor(frames / (n * 60)) % 60, h = Math.floor(frames / (n * 3600)) % 24;
  return `${pad(h)}:${pad(m)}:${pad(s)}${drop ? ';' : ':'}${pad(f)}`;
}

// ---------- The queue (kept between sessions) ----------
let queue = []; // { file, name, kind, size, info?, plan?, bad? }
let cur = null; // { item, info, plan, mode, track }
let platform = '';
const ICON = {
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-2.5v9L17 14"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  raw: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>',
  url: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  sequence: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="13" rx="2"/><path d="M7 4h13v13"/></svg>',
  unknown: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
};
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function drawQueue() {
  const ol = $('#queue');
  ol.innerHTML = queue.map((q, i) => {
    const d = q.info?.duration ? fmtClock(q.info.duration) : '';
    const v = q.info?.video;
    const sub = q.bad ? t('This file cannot be played here') : [d, v ? `${v.width}×${v.height}` : q.info?.audio?.[0] ? q.info.audio[0].codec.toUpperCase() : '', fmtSize(q.size)].filter(Boolean).join(' · ');
    return `<li data-i="${i}" class="${cur?.item === q ? 'on' : ''} ${q.bad ? 'bad' : ''}"><span class="k">${ICON[q.kind] || ICON.unknown}</span>
      <span class="n"><b title="${esc(q.file)}">${esc(q.name)}</b><small>${esc(sub)}</small></span><button class="ib x" data-x="${i}" aria-label="Remove">${X}</button></li>`;
  }).join('');
  $('#shuffle').classList.toggle('on', S.shuffle);
  store('queue', queue.map((q) => ({ file: q.file, name: q.name, kind: q.kind, size: q.size })));
}

// each file's facts, two at a time, so the queue shows lengths and sizes
let probing = 0;
function probeQueue() {
  while (probing < 2) {
    const q = queue.find((x) => !x.info && !x.probing);
    if (!q) return;
    q.probing = true; probing++;
    window.api.probe(q.file, { fps: S.seqFps }).then(({ info, plan, url, mime }) => { Object.assign(q, { info, plan, url, mime, bad: plan.mode === 'none' }); })
      .finally(() => { probing--; drawQueue(); probeQueue(); });
  }
}

async function add(paths, playFirst = true) {
  if (!paths?.length) return;
  const { files, skipped } = await window.api.inspect(paths);
  if (skipped.length) toast(esc(t('{n} left out, not video or sound: {names}', { n: skipped.length, names: skipped.slice(0, 4).join(', ') + (skipped.length > 4 ? '…' : '') })));
  if (!files.length) return;
  const start = queue.length;
  queue.push(...files);
  drawQueue();
  probeQueue();
  if (playFirst) load(queue[start], { autoplay: true });
}

// ---------- The player ----------
// A file the window plays itself is its <video>'s src. Anything else comes in pieces through a Media Source: the
// picture and the sound each from their own ffmpeg (main.js), each placed at its own time in the file, so the clock is
// always the file's own and a jump inside what has come is instant. A jump outside starts that part's ffmpeg there.
const v = $('#v');
let shuttle = 0;        // J/K/L: −8…8, 0 stopped
let rev = null;         // the reverse loop
let inPt = null, outPt = null, looping = false;
let shownTime = 0;      // the frame on screen (requestVideoFrameCallback), else the clock
let loadToken = 0;
const AHEAD = 24;       // seconds made ahead of the playhead, no more
// a player: its <video>, its Media Source ({ ms, parts: { video|audio: { sb, mime, token, from, pos, busy, reader } } })
// and what it plays ({ item, info, plan, mode, track }). `main` is the one the controls drive; the compare has `B`.
const main = { v, mse: null, cur: null, name: 'A' };
const B = { v: $('#v2'), mse: null, cur: null, name: 'B', offset: 0 };

const streaming = () => !!cur && cur.mode !== 'native';
const duration = () => (cur ? (cur.info?.duration || (isFinite(v.duration) ? v.duration : 0)) : 0);
const pos = () => (cur ? v.currentTime : 0);
const fps = () => cur?.info?.video?.fps || 25;
const hasPicture = () => !!cur?.info?.video;
// frames count from the file's first frame (`phase`, where it sits in the file's seconds), whole frames apart.
// A picture's time is a frame's own time (the one on screen); sound has no frames, so its time counts down to them.
const phase = () => cur?.info?.phase || 0;
const frameOf = (tm) => (hasPicture() ? Math.round((tm - phase()) * fps()) : Math.floor(tm * fps() + 1e-3));
const timeOf = (n) => phase() + n / fps();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setBody(cls, on) { document.body.classList.toggle(cls, !!on); }

async function load(item, { autoplay = true, at = null, track = 0, mode = null } = {}) {
  if (!item) return;
  const token = ++loadToken;
  rememberPos();
  stopReverse(); shuttle = 0; showShuttle();
  closeMse(main);
  if (!item.info) {
    showSpin(true);
    const r = await window.api.probe(item.file, { fps: S.seqFps });
    Object.assign(item, { info: r.info, plan: r.plan, url: r.url, mime: r.mime, bad: r.plan.mode === 'none' });
    if (token !== loadToken) return;
  }
  const plan = item.plan;
  cur = main.cur = { item, info: item.info, plan, mode: mode || plan.mode, track, subs: null, subTrack: null };
  inPt = outPt = null;
  if (!S.keepLook) { Object.assign(S, { aspect: 0, zoom: 1, rot: 0, flipH: false, flipV: false, brightness: 1, contrast: 1, saturation: 1 }); lutCur = null; S.lutFile = ''; applyPicture(); }
  if (!S.keepSound) { Object.assign(S, { chan: 'stereo', audDelay: 0, eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }); applyAudio(); }
  if (autoplay && !S.autoplayOpen && !item.wasAsked) autoplay = false;
  packetsOf = null; qcOf = null; drawGop(); drawQc(); drawNotes();
  // where it was left (Settings > Go on where you left off)
  if (at == null) { const was = S.resume ? positions[item.file] : 0; at = was && item.info.duration && was > 5 && was < item.info.duration - 5 ? was : 0; }
  shownTime = at;
  setBody('empty', false);
  $('#screen').classList.remove('blank');
  $('#home').hidden = true;
  $('#msg').hidden = true;
  window.api.title(`${item.name} · RoarPlay`);
  drawQueue(); drawFacts(); drawRange(); drawChapters(); drawTracks();
  if (plan.mode === 'none') return cannotPlay(plan);
  const sound = !hasPicture();
  setBody('audio', sound);
  $('#sound').hidden = !sound;
  if (sound) showSound();
  wave = null; drawWave(); thumbs.clear(); resetLufs(); drawMeters();
  if (sound) window.api.waveform({ file: item.file, track, duration: item.info.duration }).then((p) => { if (token === loadToken) { wave = p; drawWave(); } });
  if (hasPicture() && item.info.video.width) fitWindowFor(item.info.video.width / item.info.video.height, true);
  await startAt(main, at, autoplay);
  if (token !== loadToken) return;
  loadSubtitles(token);
  if (B.cur) syncB(true);
}

// the parts a stream is made of, and what the window is told each one is
function partsOf(c) {
  if (c.mode === 'audio') return { audio: c.item.mime['audio/audio'] };
  const p = { video: c.item.mime[`${c.mode}/video`] };
  if (c.info.audio.length) p.audio = c.item.mime['film/audio'];
  return p;
}

// play `pl`'s file from `at` seconds
async function startAt(pl, at, play) {
  const token = ++pl.startToken;
  const c = pl.cur, el = pl.v;
  const live = () => token === pl.startToken && pl.cur === c;
  if (pl === main) showSpin(true);
  if (c.mode === 'native') {
    closeMse(pl);
    if (el.src !== c.item.url) el.src = c.item.url;
    const go = () => { if (!live()) return; if (at > 0) el.currentTime = at; if (play) el.play().catch(() => {}); };
    if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true });
    return;
  }
  // a copied picture the window cannot take in pieces (HEVC where the system has no decoder for it) is made again
  if (c.mode === 'remux' && !MediaSource.isTypeSupported(c.item.mime['remux/video'])) { c.mode = 'transcode'; if (pl === main) drawFacts(); }
  closeMse(pl);
  const ms = new MediaSource();
  const url = URL.createObjectURL(ms);
  el.src = url;
  await new Promise((r) => ms.addEventListener('sourceopen', r, { once: true }));
  URL.revokeObjectURL(url);
  if (!live()) return;
  ms.duration = (c.info.duration || (isFinite(el.duration) ? el.duration : 0)) || 24 * 3600;
  const parts = {};
  try {
    for (const [name, mime] of Object.entries(partsOf(c))) parts[name] = { name, mime, sb: ms.addSourceBuffer(mime), token: 0, from: 0, pos: 0, busy: false, reader: null };
  } catch (e) { return fail(pl, e.message); }
  for (const P of Object.values(parts)) P.sb.addEventListener('error', () => fail(pl, 'The window could not take the stream'));
  pl.mse = { ms, parts, token };
  el.currentTime = at;
  pl.wantPlay = !!play;
  for (const P of Object.values(parts)) feed(pl, P, at);
}
const LEAD = 2; // seconds that must have come before a stream starts playing
function maybeStart(pl) {
  if (!pl.wantPlay || !pl.mse) return;
  const ct = pl.v.currentTime;
  const ready = Object.values(pl.mse.parts).every((P) => { const rg = rangeAt(P.sb, ct, 0.1); return rg && (rg[1] - ct >= LEAD || P.atEnd); });
  if (!ready) return;
  pl.wantPlay = false;
  pl.v.play().catch(() => {});
}
main.startToken = 0; B.startToken = 0;

function closeMse(pl) {
  if (!pl.mse) return;
  const ids = [];
  for (const P of Object.values(pl.mse.parts)) { P.token++; try { P.reader?.cancel(); } catch {} if (P.id) ids.push(P.id); }
  pl.mse = null;
  window.api.stop(ids);
}

// the buffered range of `sb` that holds `t`
function rangeAt(sb, t, slack = 0.05) {
  try {
    for (let i = 0; i < sb.buffered.length; i++) if (t >= sb.buffered.start(i) - slack && t <= sb.buffered.end(i) + slack) return [sb.buffered.start(i), sb.buffered.end(i)];
  } catch {}
  return null;
}
const idle = (sb) => (sb.updating ? new Promise((r) => sb.addEventListener('updateend', r, { once: true })) : Promise.resolve());

// one part's ffmpeg from `from` seconds, its pieces appended as they come, never more than AHEAD seconds ahead
async function feed(pl, P, from) {
  const m = pl.mse, c = pl.cur, el = pl.v;
  const my = ++P.token;
  const stale = () => my !== P.token || pl.mse !== m;
  try { P.reader?.cancel(); } catch {}
  P.reader = null; P.busy = true; P.from = from; P.pos = from;
  await idle(P.sb);
  if (stale()) return;
  try { if (m.ms.readyState === 'open') P.sb.abort(); } catch {}
  const r = await window.api.stream({ file: c.item.file, info: c.info, mode: c.mode, start: from, track: c.track, part: P.name, maxH: +S.playQuality });
  if (stale()) return;
  P.id = r.id;
  try { P.sb.timestampOffset = r.offset; } catch {}
  let reader;
  try { reader = (await fetch(r.url)).body.getReader(); } catch (e) { return stale() || fail(pl, e.message); }
  if (stale()) { reader.cancel(); return; }
  P.reader = reader;
  P.atEnd = false;
  try {
    for (;;) {
      // made far enough ahead, or the playhead went back before this piece: wait
      while (!stale() && (P.pos - el.currentTime > AHEAD || el.currentTime < P.from - 1)) await sleep(200);
      if (stale()) { reader.cancel(); return; }
      const { done, value } = await reader.read().catch(() => ({ done: true }));
      if (stale()) { reader.cancel(); return; }
      const d = c.info.duration || 0;
      if (done) { P.atEnd = !d || P.pos >= d - 1; break; }
      await append(P, value, el);
      if (stale()) { reader.cancel(); return; }
      maybeStart(pl);
      const rg = rangeAt(P.sb, P.pos, 0.6);
      if (!rg) continue;
      const was = P.pos;
      P.pos = Math.max(P.pos, rg[1]);
      // it ran into what had come before (a jump back, then on): that is there already, so this ffmpeg stops
      if (P.pos - was > 3) { reader.cancel(); P.atEnd = !!d && P.pos >= d - 0.3; break; }
    }
  } catch (e) {
    if (!stale()) console.warn('feed', P.name, e);
  }
  P.busy = false; P.reader = null;
  maybeStart(pl);
  endIfAll(m);
}
// the end of the file: when every part has come to it, the window is told, so it ends there
function endIfAll(m) {
  if (!Object.values(m.parts).every((x) => !x.busy && x.atEnd)) return;
  try { if (m.ms.readyState === 'open' && !Object.values(m.parts).some((x) => x.sb.updating)) m.ms.endOfStream(); } catch {}
}

async function append(P, chunk, el) {
  for (let tries = 0; tries < 4; tries++) {
    await idle(P.sb);
    try { P.sb.appendBuffer(chunk); await idle(P.sb); return; } catch (e) {
      if (e.name !== 'QuotaExceededError') throw e;
      // full: let go of what is far behind and far ahead of the playhead
      const ct = el.currentTime;
      try { if (ct - 15 > 0) { P.sb.remove(0, ct - 15); await idle(P.sb); } P.sb.remove(ct + AHEAD + 10, Infinity); await idle(P.sb); } catch {}
      await sleep(300);
    }
  }
}

// keeps every part coming where the playhead is: a part with nothing there starts there, a part about to run out goes on
function keepFed(pl) {
  if (!pl.mse || !pl.cur) return;
  const ct = pl.v.currentTime, d = pl.cur.info.duration || 0;
  for (const P of Object.values(pl.mse.parts)) {
    const rg = rangeAt(P.sb, ct);
    const coming = P.busy && ct >= P.from - 0.25 && ct <= P.pos + 4;
    if (!rg) { if (!coming) feed(pl, P, ct); continue; }
    if ((!d || rg[1] < d - 0.3) && rg[1] - ct < 8 && !(P.busy && P.pos >= rg[1] - 0.6 && P.from <= rg[1] + 0.6)) feed(pl, P, rg[1]);
  }
}
setInterval(() => { keepFed(main); keepFed(B); }, 250);

// go to `t` seconds of the file. A stream jumps inside what has come; outside it, each part starts again there
// (`back` seconds earlier when going backwards, so the next steps back are there already)
function seek(t, { back = 0, play = null } = {}) {
  if (!cur || cur.plan.mode === 'none') return;
  const d = duration();
  t = Math.max(0, d ? Math.min(t, Math.max(0, d - 1 / fps() / 2)) : t);
  shownTime = t;
  v.currentTime = t;
  let gap = false;
  if (main.mse) for (const P of Object.values(main.mse.parts)) if (!rangeAt(P.sb, t, 0)) { gap = true; feed(main, P, Math.max(0, t - back)); }
  if (play) { if (gap) main.wantPlay = true; else v.play().catch(() => {}); }
  if (B.cur) syncB(true);
  paint();
}

function fail(pl, detail) {
  const c = pl.cur;
  if (!c) return;
  // what the window cannot take as it is, ffmpeg makes again
  if (c.mode === 'native' || c.mode === 'remux') {
    const at = pl.v.currentTime;
    c.mode = c.info.video ? 'transcode' : 'audio';
    if (pl === main) drawFacts();
    startAt(pl, at, !pl.v.paused);
    return;
  }
  if (pl === main) cannotPlay({ why: 'failed', detail }); else { toast(esc(detail || 'B could not be played')); setCompare(null); }
}

v.addEventListener('loadedmetadata', () => { paint(); placeMask(); applyLut(); drawNotes(); });
v.addEventListener('canplay', () => showSpin(false));
v.addEventListener('waiting', () => { showSpin(true); keepFed(main); });
v.addEventListener('playing', () => { showSpin(false); setBody('playing', true); audioStart(); });
v.addEventListener('pause', () => { if (!rev) setBody('playing', false); rememberPos(); });
v.addEventListener('seeked', () => { showSpin(false); paint(); });
v.addEventListener('ended', () => {
  setBody('playing', false); shuttle = 0; showShuttle();
  forgetPos();
  if (looping) return seek(inPt ?? 0, { play: true });
  if (S.atEnd === 'repeat') return seek(0, { play: true });
  if (S.atEnd === 'next') next(1, true);
});
v.addEventListener('error', () => { if (cur && v.getAttribute('src')) fail(main, v.error?.message); });
B.v.addEventListener('error', () => { if (B.cur && B.v.getAttribute('src')) fail(B, B.v.error?.message); });
window.api.onStreamError(({ id, error }) => {
  for (const pl of [main, B]) {
    if (!pl.mse || !Object.values(pl.mse.parts).some((P) => P.id === id)) continue;
    if (pl.cur.mode === 'remux') return fail(pl, error);
    if (pl === main) cannotPlay({ why: 'failed', detail: error }); else fail(pl, error);
  }
});

function cannotPlay(plan) {
  showSpin(false);
  setBody('playing', false);
  closeMse(main);
  $('#sound').hidden = true;
  $('#msg').hidden = false;
  v.removeAttribute('src'); v.load();
  $('#msgTitle').textContent = plan.why === 'raw' ? t('This file cannot be played here') : t('This file could not be played');
  $('#msgText').textContent = plan.why === 'raw' ? t('{f} is opened by {app}.', { f: plan.format, app: plan.app }) : (plan.detail || t('It may be damaged or not a video or sound file.'));
  cur.item.bad = true;
  drawQueue();
}

async function showSound() {
  const i = cur.info;
  $('#soundTitle').textContent = i.title || cur.item.name;
  $('#soundBy').textContent = [i.artist, i.album].filter(Boolean).join(' · ') || [i.audio[0]?.codec?.toUpperCase(), i.audio[0]?.sampleRate ? `${i.audio[0].sampleRate / 1000} kHz` : '', i.audio[0]?.channels].filter(Boolean).join(' · ');
  const art = $('#art');
  art.querySelector('img')?.remove();
  art.querySelector('svg').style.display = '';
  if (i.cover) {
    const item = cur.item;
    const src = await window.api.cover(item.file);
    if (src && cur?.item === item) { const img = new Image(); img.src = src; art.querySelector('svg').style.display = 'none'; art.append(img); }
  }
}

// where each file was left, for Go on where you left off
const positions = fetchStore('positions', {});
function rememberPos() {
  if (!cur || !duration()) return;
  const p = pos();
  if (p > 5 && p < duration() - 5) positions[cur.item.file] = p; else delete positions[cur.item.file];
  const keys = Object.keys(positions); if (keys.length > 500) delete positions[keys[0]];
  store('positions', positions);
}
function forgetPos() { if (cur) { delete positions[cur.item.file]; store('positions', positions); } }
setInterval(() => { if (cur && !v.paused) rememberPos(); }, 5000);
window.addEventListener('beforeunload', rememberPos);

// ---------- J / K / L, the speed and the reverse ----------
function setShuttle(n) {
  shuttle = n;
  showShuttle();
  if (n === 0) { stopReverse(); v.pause(); v.playbackRate = S.speed; return; }
  if (n > 0) { stopReverse(); v.playbackRate = n === 1 ? S.speed : n; v.play().catch(() => {}); return; }
  v.pause();
  startReverse();
}
function startReverse() {
  if (rev) return;
  setBody('playing', true);
  let last = performance.now();
  let target = pos();
  const tick = (now) => {
    if (!rev) return;
    const dt = (now - last) / 1000; last = now;
    if (!v.seeking) {
      target = Math.max(0, target - dt * Math.abs(shuttle));
      seek(target, { back: 6 });
      if (target <= 0) { setShuttle(0); return; }
    }
    rev = requestAnimationFrame(tick);
  };
  rev = requestAnimationFrame(tick);
}
function stopReverse() { if (rev) cancelAnimationFrame(rev); rev = null; if (v.paused) setBody('playing', false); }
function showShuttle() {
  const el = $('#shuttle');
  el.hidden = !shuttle || shuttle === 1;
  el.textContent = shuttle < 0 ? `◀◀ ${-shuttle}×` : `${shuttle}× ▶▶`;
}
const L = () => setShuttle(shuttle <= 0 ? 1 : Math.min(8, shuttle * 2));
const J = () => setShuttle(shuttle >= 0 ? -1 : Math.max(-8, shuttle * 2));
const K = () => setShuttle(0);
function togglePlay() {
  if (!cur || cur.plan.mode === 'none') return;
  if (shuttle !== 0 || !v.paused) return K();
  if (duration() && pos() >= duration() - 0.05) seek(inPt ?? 0);
  setShuttle(1);
}
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
function setSpeed(x) {
  S.speed = Math.max(0.25, Math.min(4, +x || 1)); save();
  if (shuttle <= 1) v.playbackRate = S.speed;
  $('#speedBtn').textContent = `${+S.speed.toFixed(2)}×`;
  $('#speedBtn').classList.toggle('lit', S.speed !== 1);
  placeLenses();
}
function speedStep(n) { const i = SPEEDS.indexOf(S.speed); setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 3 : i) + n))]); }

// one frame: from the frame on screen, to the next frame's own time
function step(n) {
  if (!cur || cur.plan.mode === 'none') return;
  if (shuttle) setShuttle(0); else v.pause();
  if (!hasPicture()) return seek(pos() + n * 0.1);
  seek(timeOf(frameOf(shownTime) + n) + 0.0005);
}

// ---------- In, out, loop ----------
function mark(which) {
  if (!cur) return;
  const p = timeOf(frameOf(shownTime));
  if (which === 'in') { inPt = p; if (outPt != null && outPt <= inPt) outPt = null; }
  else { outPt = p; if (inPt != null && inPt >= outPt) inPt = null; }
  drawRange();
}
function clearMarks(which = 'both') {
  if (which !== 'out') inPt = null;
  if (which !== 'in') outPt = null;
  drawRange();
}
function drawRange() {
  const d = duration();
  const r = $('#range');
  const any = d && (inPt != null || outPt != null);
  r.hidden = !any;
  $('#clearIO').hidden = !any;
  $('#inMark').hidden = !(d && inPt != null);
  $('#outMark').hidden = !(d && outPt != null);
  if (!any) return;
  const a = (inPt ?? 0) / d, b = (outPt ?? d) / d;
  r.style.left = `${a * 100}%`; r.style.width = `${(b - a) * 100}%`;
  $('#inMark').style.left = `${a * 100}%`;
  $('#outMark').style.left = `${b * 100}%`;
}
function setLoop(on) { looping = on; $('#loop').classList.toggle('on', on); }
function playRange() { if (!cur) return; shuttle = 1; showShuttle(); stopReverse(); v.playbackRate = S.speed; seek(inPt ?? 0, { play: true }); }

// ---------- Chapters ----------
const chapters = () => cur?.info?.chapters || [];
function drawChapters() {
  const d = duration();
  $('#chaps').innerHTML = d ? chapters().filter((c) => c.start > 0.5).map((c) => `<i style="left:${(c.start / d) * 100}%" title="${esc(c.title)}"></i>`).join('') : '';
}
function chapterAt(tm) { let c = null; for (const x of chapters()) if (x.start <= tm) c = x; return c; }
function chapterStep(n) {
  const cs = chapters(); if (!cs.length) return;
  const tm = pos();
  if (n > 0) { const nx = cs.find((c) => c.start > tm + 0.5); if (nx) seek(nx.start); }
  else { const prev = [...cs].reverse().find((c) => c.start < tm - 2); seek(prev ? prev.start : 0); }
}

// ---------- The clock and the bar ----------
const CLOCK_MODES = ['tc', 'time', 'frames'];
function clockText(tm) {
  const f = fps();
  if (S.clockMode === 'time') return fmtTime(tm);
  if (S.clockMode === 'frames') return String(Math.max(0, frameOf(tm)));
  const base = cur?.info?.timecode || '00:00:00:00';
  const drop = isDrop(f, base);
  return framesToTc(tcToFrames(base, f, drop) + Math.max(0, frameOf(tm)), f, drop);
}
const EL_tc = $('#tc'), EL_done = $('#done'), EL_head = $('#head'), EL_buf = $('#buf'), EL_len = $('#len'), EL_bzTc = $('#bzTc');
let lastClock = '';
function paint(force) {
  const d = duration();
  const tm = force ?? (hasPicture() || (v.paused && !rev) ? shownTime : pos());
  const text = cur ? clockText(tm) : clockText(0);
  if (text !== lastClock) { lastClock = text; EL_tc.textContent = text; if (document.body.classList.contains('compact')) EL_bzTc.textContent = text; }
  const pct = d ? Math.min(1, tm / d) : 0;
  EL_done.style.width = `${pct * 100}%`;
  EL_head.style.left = `${pct * 100}%`;
  if (document.body.classList.contains('compact')) $('#bzDone').style.width = `${pct * 100}%`;
  // what has arrived, from the playhead on
  if (cur && d && v.buffered.length) {
    let end = 0;
    for (let i = 0; i < v.buffered.length; i++) end = Math.max(end, v.buffered.end(i));
    EL_buf.style.width = `${Math.min(1, end / d) * 100}%`;
  } else EL_buf.style.width = '0';
  // the loop and the out point
  if (cur && !v.paused && outPt != null && tm >= outPt) {
    if (looping) seek(inPt ?? 0); else { v.pause(); seek(outPt); }
  }
  paintSubs(tm);
}
function lenText() {
  if (!cur) return '';
  const d = duration();
  return `/ ${S.clockMode === 'tc' ? clockText(d) : S.clockMode === 'frames' ? Math.round(d * fps()) : fmtTime(d)}`;
}
function frameLoop() {
  if (cur && !v.paused && !hasPicture()) shownTime = pos();
  paint();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
setInterval(() => { EL_len.textContent = lenText(); }, 500);
// the exact frame on screen, so a step goes from there
function watchFrames() {
  v.requestVideoFrameCallback((_n, m) => { if (cur) shownTime = m.mediaTime; watchFrames(); });
}
watchFrames();
v.addEventListener('timeupdate', () => { if (!hasPicture() && cur) shownTime = pos(); });

const bar = $('#bar');
const barTime = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration(); };
let scrubbing = false;
bar.addEventListener('pointerdown', (e) => { if (!cur || e.target.classList.contains('mark')) return; scrubbing = true; bar.setPointerCapture(e.pointerId); if (shuttle < 0) setShuttle(0); seek(barTime(e)); });
bar.addEventListener('pointermove', (e) => {
  if (!cur) return;
  const tm = barTime(e);
  const tip = $('#tip');
  tip.hidden = false;
  const ch = chapterAt(tm);
  $('#tipText').textContent = clockText(tm) + (ch?.title ? ` · ${ch.title}` : '');
  tip.style.left = `${(tm / (duration() || 1)) * 100}%`;
  if (scrubbing) seek(tm); else showThumb(tm);
});
bar.addEventListener('pointerup', () => { scrubbing = false; });
bar.addEventListener('pointerleave', () => { $('#tip').hidden = true; });
$('#inMark').addEventListener('click', (e) => { e.stopPropagation(); clearMarks('in'); });
$('#outMark').addEventListener('click', (e) => { e.stopPropagation(); clearMarks('out'); });
$('#tc').addEventListener('click', () => { S.clockMode = CLOCK_MODES[(CLOCK_MODES.indexOf(S.clockMode) + 1) % 3]; save(); placeLenses(); });

// a small frame under the mouse on the bar, one a second, kept while the file is open
const thumbs = new Map();
let thumbTimer = 0, thumbWant = -1;
function showThumb(tm) {
  const img = $('#tipImg');
  if (!hasPicture() || !cur) { img.hidden = true; return; }
  const key = Math.floor(tm);
  if (thumbs.has(key)) { const src = thumbs.get(key); if (src) { img.src = src; img.hidden = false; } return; }
  thumbWant = key;
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(async () => {
    if (!cur || thumbs.has(key)) return;
    thumbs.set(key, null);
    const item = cur.item;
    const src = await window.api.thumb({ file: item.file, at: key + 0.5, info: cur.info });
    if (cur?.item !== item) return;
    thumbs.set(key, src);
    if (src && thumbWant === key && !$('#tip').hidden) { img.src = src; img.hidden = false; }
  }, 120);
}

// the sound's shape behind the bar
let wave = null;
function drawWave() {
  const c = $('#wave');
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (!wave?.length) return;
  const mid = c.height / 2, w = c.width;
  const played = duration() ? pos() / duration() : 0;
  for (let x = 0; x < w; x += 2 * dpr) {
    const p = wave[Math.min(wave.length - 1, Math.floor((x / w) * wave.length))];
    const h = Math.max(1, Math.sqrt(p) * mid * 0.95);
    g.fillStyle = x / w <= played ? '#ff3b30' : 'rgba(255,255,255,.28)';
    g.fillRect(x, mid - h, dpr * 1.2, h * 2);
  }
}
setInterval(() => { if (document.body.classList.contains('audio') && !v.paused) drawWave(); }, 150);
window.addEventListener('resize', () => { drawWave(); placeMask(); placeLenses(); });

// ---------- Subtitles: the file's tracks, files beside it, a chosen file; drawn by the page ----------
let subChoices = []; // { kind: 'track'|'file', n?, file?, label }
async function loadSubtitles(token) {
  subChoices = [];
  if (!cur || !hasPicture()) { drawSubsList(); paintSubs(0); return; }
  for (const s of cur.info.subs || []) subChoices.push({ kind: 'track', n: s.n, bitmap: s.bitmap, label: [s.lang?.toUpperCase(), s.title, s.codec].filter(Boolean).join(' · ') || `#${s.n + 1}`, where: t('in the file') });
  const beside = await window.api.subFiles(cur.item.file).catch(() => []);
  if (token !== loadToken) return;
  for (const f of beside) subChoices.push({ kind: 'file', file: f.file, label: f.name, where: f.lang?.toUpperCase() || '' });
  drawSubsList();
  // the preferred language first, else the first track, or the first file beside, by itself
  const lang = (S.subLang || '').toLowerCase();
  const first = (lang && subChoices.find((c) => !c.bitmap && (c.label.toLowerCase().startsWith(lang) || (c.where || '').toLowerCase() === lang))) || subChoices.find((c) => !c.bitmap);
  if (first && S.subOn && S.subAuto) chooseSubs(first); else { cur.subs = null; paintSubs(0); }
}
async function chooseSubs(choice) {
  if (!cur) return;
  const token = loadToken;
  cur.subTrack = choice;
  cur.subs = null;
  drawSubsList();
  if (!choice) { paintSubs(0); return; }
  const r = await window.api.subtitles({ file: cur.item.file, track: choice.kind === 'track' ? choice.n : null, subFile: choice.kind === 'file' ? choice.file : null });
  if (token !== loadToken || cur.subTrack !== choice) return;
  if (!r.ok) { toast(esc(t('Could not read the subtitles')) + `: ${esc(r.error)}`); cur.subTrack = null; drawSubsList(); return; }
  cur.subs = parseVtt(r.vtt);
  S.subOn = true; save();
  $('#subsBtn').classList.add('lit');
}
// WebVTT -> cues, with the basic marks (i, b, u) kept and everything else as text
function parseVtt(text) {
  const cues = [];
  const tm = (s) => { const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s); return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const html = lines.slice(i + 1).join('\n').replace(/<\/?(?:v|c|lang|ruby|rt)[^>]*>/g, '').replace(/<(\/?)(i|b|u)[^>]*>/g, '<$1$2>').replace(/<[^>]*>/g, (x) => (/^<\/?(i|b|u)>$/.test(x) ? x : ''));
    cues.push({ start: tm(a), end: tm(b), html: html.trim() });
  }
  return cues;
}
let lastSubKey = '';
function paintSubs(tm) {
  const box = $('#subs');
  if (!cur?.subs || !S.subOn) { if (lastSubKey) { lastSubKey = ''; box.hidden = true; box.innerHTML = ''; } return; }
  const at = tm - S.subDelay;
  const on = cur.subs.filter((c) => at >= c.start && at < c.end);
  const key = on.map((c) => c.start).join(',');
  if (key === lastSubKey) return;
  lastSubKey = key;
  box.hidden = !on.length;
  box.innerHTML = on.map((c) => `<span>${c.html.split('\n').map((l) => l).join('<br>')}</span>`).join('');
}
function drawSubsList() {
  const box = $('#subsList');
  if (!cur || !hasPicture()) { box.innerHTML = `<div class="none">${esc(t('None in the file or beside it.'))}</div>`; return; }
  const off = `<button data-sub="off" class="${!cur.subTrack || !S.subOn ? 'on' : ''}">${esc(t('Off'))}</button>`;
  const rows = subChoices.map((c, i) => `<button data-sub="${i}" class="${cur.subTrack === c && S.subOn ? 'on' : ''}" ${c.bitmap ? 'disabled' : ''}>${esc(c.label)}<small>${esc(c.bitmap ? t('bitmap, cannot be shown') : c.where)}</small></button>`).join('');
  box.innerHTML = off + rows + (subChoices.length ? '' : `<div class="none">${esc(t('None in the file or beside it.'))}</div>`);
  $('#subsBtn').classList.toggle('lit', !!(cur.subTrack && S.subOn));
  $('#subDelay').textContent = `${S.subDelay >= 0 ? '+' : ''}${S.subDelay.toFixed(1)} s`;
}
$('#subsList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-sub]'); if (!b || !cur) return;
  if (b.dataset.sub === 'off') { S.subOn = false; save(); drawSubsList(); paintSubs(0); return; }
  S.subOn = true; save(); chooseSubs(subChoices[+b.dataset.sub]);
});
$('#subsFile').addEventListener('click', async () => {
  const f = await window.api.pickSub(S.lang); if (!f || !cur) return;
  const c = { kind: 'file', file: f, label: f.split(/[\\/]/).pop(), where: '' };
  subChoices.push(c); chooseSubs(c);
});
$('#subEarlier').addEventListener('click', () => { S.subDelay = +(S.subDelay - 0.5).toFixed(1); save(); drawSubsList(); lastSubKey = ''; });
$('#subLater').addEventListener('click', () => { S.subDelay = +(S.subDelay + 0.5).toFixed(1); save(); drawSubsList(); lastSubKey = ''; });
function toggleSubs() { if (!cur?.subs && subChoices.length) return chooseSubs(subChoices.find((c) => !c.bitmap)); S.subOn = !S.subOn; save(); drawSubsList(); lastSubKey = ''; }
function applySubSize() { document.body.classList.toggle('sub-s', S.subSize === 's'); document.body.classList.toggle('sub-l', S.subSize === 'l'); }

// ---------- The picture: frame, aspect, zoom, turn, look; the window's shape ----------
function applyPicture() {
  // with an aspect chosen and the window shaped by it, the picture fills that frame (unless 1:1 was asked)
  v.style.objectFit = +S.aspect && windowFollows() && S.fitMode !== 'none' ? 'cover' : S.fitMode;
  const tf = [`rotate(${S.rot}deg)`, `scale(${(S.flipH ? -1 : 1) * S.zoom}, ${(S.flipV ? -1 : 1) * S.zoom})`];
  v.style.transform = tf.join(' ');
  v.style.filter = S.brightness !== 1 || S.contrast !== 1 || S.saturation !== 1 ? `brightness(${S.brightness}) contrast(${S.contrast}) saturate(${S.saturation})` : '';
  for (const k of ['brightness', 'contrast', 'saturation']) { const el = $('#' + k); el.value = S[k]; el.style.setProperty('--p', `${((S[k] - el.min) / (el.max - el.min)) * 100}%`); }
  $('#pictureBtn').classList.toggle('lit', S.fitMode !== 'contain' || +S.aspect !== 0 || S.zoom !== 1 || S.rot !== 0 || S.flipH || S.flipV || !!v.style.filter || !!lutCur);
  placeMask();
  placeLenses();
  if (typeof applyLut === 'function') applyLut();
  if (typeof B !== 'undefined' && B.cur) { B.v.style.transform = v.style.transform; B.v.style.filter = v.style.filter; B.v.style.objectFit = S.fitMode; }
}
// the aspect mask: dark bands over what falls outside the chosen frame, on the picture as it is shown
// the window follows the chosen aspect (Alex, 31 Oct: "the aspect ratio changes the window's shape"); the mask is
// for when it cannot: full screen, the bezel, or the window not following the picture
const windowFollows = () => S.followPic && !document.fullscreenElement && !document.body.classList.contains('compact');
function placeMask() {
  const m = $('#mask');
  const ratio = +S.aspect;
  if (!ratio || !cur || !hasPicture() || !v.videoWidth || windowFollows()) { m.hidden = true; return; }
  const box = $('#pic').getBoundingClientRect();
  const vr = v.videoWidth / v.videoHeight;
  // where the picture sits inside the box (Fit): the mask is cut from that
  let pw = box.width, ph = box.height;
  if (S.fitMode === 'contain') { if (pw / ph > vr) pw = ph * vr; else ph = pw / vr; }
  let mw = pw, mh = ph;
  if (mw / mh > ratio) mw = mh * ratio; else mh = mw / ratio;
  m.hidden = false;
  m.style.width = `${mw}px`; m.style.height = `${mh}px`;
  m.style.left = `${(box.width - mw) / 2}px`; m.style.top = `${(box.height - mh) / 2}px`;
}
// the window takes the picture's shape (Alex, 31 Oct): the picture's ratio, plus what sits around the picture
function fitWindow(resize) {
  if (!cur || !hasPicture() || !v.videoWidth) { window.api.fit({ ratio: 0 }); return; }
  fitWindowFor(v.videoWidth / v.videoHeight, resize);
}
function fitWindowFor(picRatio, resize) {
  if (!S.followPic || document.fullscreenElement) { window.api.fit({ ratio: 0 }); return; }
  const box = $('#pic').getBoundingClientRect();
  const extra = { width: window.innerWidth - box.width, height: window.innerHeight - box.height };
  let ratio = picRatio;
  if (S.rot % 180) ratio = 1 / ratio;
  if (+S.aspect) ratio = +S.aspect;
  window.api.fit({ ratio, extra, resize });
}
function resetPicture() { Object.assign(S, { fitMode: 'contain', aspect: 0, zoom: 1, rot: 0, flipH: false, flipV: false, brightness: 1, contrast: 1, saturation: 1 }); save(); applyPicture(); fitWindow(false); }
$('#pictureReset').addEventListener('click', resetPicture);
for (const k of ['brightness', 'contrast', 'saturation']) $('#' + k).addEventListener('input', (e) => { S[k] = +e.target.value; save(); applyPicture(); });
$('#followPic').addEventListener('input', (e) => { S.followPic = e.target.checked; $('#followPic2').checked = S.followPic; save(); fitWindow(true); applyPicture(); });
$('#followPic2').addEventListener('input', (e) => { S.followPic = e.target.checked; $('#followPic').checked = S.followPic; save(); fitWindow(true); applyPicture(); });
$('#onTop').addEventListener('input', (e) => { S.onTop = e.target.checked; save(); window.api.onTop(S.onTop); $('#bzTop').classList.toggle('on', S.onTop); });

// ---------- Sound: tracks, what you hear, delay, output, equalizer (Web Audio) ----------
const EQ_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_PRESETS = { flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], voice: [-3, -2, 0, 2, 4, 4, 3, 1, 0, -1], bass: [6, 5, 3, 1, 0, 0, 0, 0, 0, 0], bright: [0, 0, 0, 0, 0, 1, 2, 4, 5, 5] };
let audio = null; // { ctx, src, splitter, merger, gains: [L->L, L->R, R->L, R->R], delay, eq: [], out }
function audioStart() {
  if (audio) { audio.ctx.resume().catch(() => {}); return; }
  try {
    const ctx = new AudioContext({ latencyHint: 'playback' });
    const src = ctx.createMediaElementSource(v);
    src.channelCountMode = 'max'; src.channelInterpretation = 'discrete';
    // up to six channels in (L R C LFE Ls Rs), each with a gain into the left and one into the right of the stereo out
    const N = 6;
    const splitter = ctx.createChannelSplitter(N);
    const merger = ctx.createChannelMerger(2);
    const gains = []; // gains[c * 2 + side]
    for (let c = 0; c < N; c++) for (let side = 0; side < 2; side++) { const g = ctx.createGain(); splitter.connect(g, c); g.connect(merger, 0, side); gains.push(g); }
    const delay = ctx.createDelay(2);
    const eq = EQ_HZ.map((hz, i) => { const f = ctx.createBiquadFilter(); f.type = i === 0 ? 'lowshelf' : i === EQ_HZ.length - 1 ? 'highshelf' : 'peaking'; f.frequency.value = hz; f.Q.value = 1.1; return f; });
    src.connect(splitter); merger.connect(delay);
    let last = delay; for (const f of eq) { last.connect(f); last = f; }
    last.connect(ctx.destination);
    audio = { ctx, src, splitter, merger, gains, delay, eq, N };
    applyAudio();
    tapAudio();
  } catch (e) { console.warn('audio graph', e); }
}
function applyAudio() {
  if (audio) {
    // what each of the six channels gives to the left and the right out: a plain downmix (centre and surrounds at −3 dB,
    // no LFE), or one side, or one channel alone
    const k = 0.7071;
    const M = {
      stereo: [[1, 0], [0, 1], [k, k], [0, 0], [k, 0], [0, k]], left: [[1, 1], [0, 0], [k, k], [0, 0], [k, k], [0, 0]], right: [[0, 0], [1, 1], [k, k], [0, 0], [0, 0], [k, k]],
      mono: [[0.5, 0.5], [0.5, 0.5], [k, k], [0, 0], [0.35, 0.35], [0.35, 0.35]], swap: [[0, 1], [1, 0], [k, k], [0, 0], [0, k], [k, 0]],
      center: [[0, 0], [0, 0], [1, 1], [0, 0], [0, 0], [0, 0]], surround: [[0, 0], [0, 0], [0, 0], [0, 0], [1, 0], [0, 1]],
    }[S.chan] || [[1, 0], [0, 1], [k, k], [0, 0], [k, 0], [0, k]];
    audio.gains.forEach((n, i) => { n.gain.value = M[Math.floor(i / 2)][i % 2]; });
    audio.delay.delayTime.value = Math.max(0, S.audDelay) / 1000;
    audio.eq.forEach((f, i) => { f.gain.value = S.eq[i] || 0; });
    if (S.outDevice && audio.ctx.setSinkId) audio.ctx.setSinkId(S.outDevice).catch(() => {});
    else if (!S.outDevice && audio.ctx.setSinkId) audio.ctx.setSinkId('').catch(() => {});
  }
  $('#audDelay').textContent = `${S.audDelay} ms`;
  $('#audioBtn').classList.toggle('lit', S.chan !== 'stereo' || S.audDelay !== 0 || S.eq.some((x) => x) || !!S.outDevice);
  $$('#eq input').forEach((el, i) => { el.value = S.eq[i] || 0; });
  placeLenses();
}
$('#eq').innerHTML = EQ_HZ.map((hz, i) => `<label><input type="range" min="-12" max="12" step="1" data-band="${i}" aria-label="${hz} Hz"><small>${hz >= 1000 ? `${hz / 1000}k` : hz}</small></label>`).join('');
$('#eq').addEventListener('input', (e) => { const b = e.target.dataset.band; if (b == null) return; S.eq[+b] = +e.target.value; save(); applyAudio(); });
$('#eqPresets').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.eq = [...EQ_PRESETS[b.dataset.v]]; save(); applyAudio(); });
$('#audEarlier').addEventListener('click', () => { S.audDelay = Math.max(0, S.audDelay - 50); save(); applyAudio(); });
$('#audLater').addEventListener('click', () => { S.audDelay = Math.min(2000, S.audDelay + 50); save(); applyAudio(); });
async function drawDevices() {
  const sel = $('#outDevice');
  let list = [];
  try { list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput'); } catch {}
  const html = `<option value="">${esc(t('System default'))}</option>` + list.filter((d) => d.deviceId && d.deviceId !== 'default').map((d) => `<option value="${esc(d.deviceId)}">${esc(d.label || d.deviceId.slice(0, 8))}</option>`).join('');
  for (const el of [sel, $('#outDevice2')]) { el.innerHTML = html; el.value = list.some((d) => d.deviceId === S.outDevice) ? S.outDevice : ''; }
}
for (const id of ['outDevice', 'outDevice2']) $('#' + id).addEventListener('change', (e) => { S.outDevice = e.target.value; save(); applyAudio(); drawDevices(); });
navigator.mediaDevices?.addEventListener?.('devicechange', drawDevices);
function drawTracks() {
  const box = $('#tracksList');
  const a = cur?.info?.audio || [];
  if (a.length < 2) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = a.map((x, n) => `<button data-track="${n}" class="${n === cur.track ? 'on' : ''}">${esc(t('Sound track {n}', { n: n + 1 }))}<small>${esc([x.lang.toUpperCase(), x.codec.toUpperCase(), x.channels].filter(Boolean).join(' · '))}</small></button>`).join('');
}
function chooseTrack(track) {
  if (!cur || track === cur.track) return;
  // another sound track: the window plays only the first, so the file comes through ffmpeg from here
  const at = pos(), playing = !v.paused;
  cur.track = track;
  if (cur.mode === 'native') cur.mode = cur.info.video ? (['h264', 'hevc', 'vp9', 'av1'].includes(cur.info.video.codec) ? 'remux' : 'transcode') : 'audio';
  drawFacts(); drawTracks();
  startAt(main, at, playing);
}
$('#tracksList').addEventListener('click', (e) => { const b = e.target.closest('button[data-track]'); if (b) chooseTrack(+b.dataset.track); });
$('#facts').addEventListener('click', (e) => { const b = e.target.closest('button[data-track]'); if (b) chooseTrack(+b.dataset.track); });

// ---------- Volume, full screen, picture in picture, the bezel ----------
function setVolume(x) {
  S.volume = Math.max(0, Math.min(1, x)); v.volume = S.volume; $('#volume').value = S.volume;
  $('#volume').style.setProperty('--p', `${S.volume * 100}%`); save();
}
function setMuted(m) { S.muted = m; v.muted = m; setBody('muted', m); save(); }
$('#volume').addEventListener('input', (e) => { setVolume(+e.target.value); if (S.muted) setMuted(false); });
$('#mute').addEventListener('click', () => setMuted(!S.muted));
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else $('#stage').requestFullscreen().catch(() => {}); }
document.addEventListener('fullscreenchange', () => { setTimeout(() => { applyPicture(); fitWindow(false); }, 100); });
function togglePip() { if (!cur || !hasPicture()) return; if (document.pictureInPictureElement) document.exitPictureInPicture(); else v.requestPictureInPicture().catch(() => {}); }
let idleTimer = 0;
document.addEventListener('mousemove', () => {
  $('#stage').classList.remove('idle'); document.body.classList.remove('idle'); document.body.classList.remove('idle-ui'); document.body.classList.add('show-bar');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (document.fullscreenElement && !v.paused) $('#stage').classList.add('idle');
    if (!v.paused && !Object.values(POPS).some((id) => !$('#' + id).hidden) && $('#settings').hidden && !document.querySelector('.side:hover')) document.body.classList.add('idle-ui');
    if (document.body.classList.contains('compact')) { document.body.classList.remove('show-bar'); if (!v.paused) document.body.classList.add('idle'); }
  }, S.idleSecs * 1000 + 200);
});
// the small bezel: only the picture inside a thin frame, the controls when the mouse comes
let compactBefore = null;
function setCompact(on) {
  const was = document.body.classList.contains('compact');
  if (on === was) return;
  if (on) { compactBefore = { side: S.side, onTop: S.onTop }; S.side = false; if (S.bezelTop && !S.onTop) window.api.onTop(true); }
  else if (compactBefore) { S.side = compactBefore.side; if (S.bezelTop && !compactBefore.onTop) window.api.onTop(false); compactBefore = null; }
  setBody('compact', on);
  document.body.classList.toggle('show-bar', on);
  $('#bezelBar').hidden = !on;
  closePops();
  window.api.compact(on);
  showSide();
  setTimeout(() => { applyPicture(); fitWindow(true); EL_bzTc.textContent = lastClock; }, 60);
}
$('#bzPlay').addEventListener('click', togglePlay);
$('#bzBar').addEventListener('pointerdown', (e) => { if (!cur) return; const r = $('#bzBar').getBoundingClientRect(); seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration()); });
$('#bzBack').addEventListener('click', () => setCompact(false));
$('#bzTop').addEventListener('click', () => { S.onTop = !S.onTop; save(); $('#onTop').checked = S.onTop; window.api.onTop(S.onTop); $('#bzTop').classList.toggle('on', S.onTop); });

// ---------- The snapshot: the frame on screen, at full size, as a picture ----------
async function snapshot() {
  if (!cur || !hasPicture()) return;
  const label = (S.snapName === 'time' ? fmtTime(shownTime) : S.snapName === 'frame' ? `f${frameOf(shownTime)}` : clockText(shownTime)).replace(/[:;]/g, '-');
  const r = await window.api.snapshot({ file: cur.item.file, at: shownTime - 0.25 / fps(), label, info: cur.info, format: S.snapFormat, where: S.snapWhere, folder: S.snapDir });
  if (!r.ok) return toast(esc(t('The frame could not be saved')) + (r.error ? `: ${esc(r.error)}` : ''));
  const name = r.out.split(/[\\/]/).pop();
  toast(`${esc(t('Saved {name}', { name }))} · <a id="showSnap">${esc(t('Show'))}</a>`);
  $('#showSnap')?.addEventListener('click', () => window.api.reveal(r.out));
}
function showSnapDir() { $('#snapDirText').textContent = S.snapWhere === 'folder' ? S.snapDir : ''; }

// ---------- The facts: everything the file says ----------
function drawFacts() {
  const box = $('#facts');
  if (!cur) { box.innerHTML = `<div class="empty">${esc(t('Nothing open yet.'))}</div>`; return; }
  const i = cur.info, q = cur.item, vi = i.video, d = i.detail || { format: { tags: {} }, streams: [], chapters: [] };
  const HOW = { native: 'Plays as it is', remux: 'Sound made AAC while it plays', transcode: 'Picture made H.264 while it plays', audio: 'Sound made FLAC while it plays' };
  const f = (k, val, wide = false) => (val ? `<div class="f ${wide ? 'wide' : ''}"><span>${esc(t(k))}</span><b>${esc(val)}</b></div>` : '');
  const tags = (o) => Object.entries(o || {}).map(([k, val]) => `<div class="f ${val.length > 28 ? 'wide' : ''}"><span>${esc(k)}</span><b>${esc(val)}</b></div>`).join('');
  const dir = q.file.slice(0, q.file.length - q.name.length - 1);
  let html = `<div class="fname">${esc(q.name)}</div><div class="where">${esc(dir)}</div>`;
  if (cur.plan.mode !== 'none') html += `<span class="chip how ${cur.mode}"><i></i>${esc(t(HOW[cur.mode]))}</span>`;
  // the file
  html += `<div class="box"><h4>${esc(t('File'))}</h4>${f('Title', i.title)}${f('Size', fmtSize(q.size || i.file?.size))}${f('Wrapper', d.format.name || i.container)}${f('Length', i.duration ? fmtTime(i.duration) : '')}${f('Starts at', d.format.start && +d.format.start ? `${d.format.start} s` : '')}${f('Bitrate', fmtRate(i.bitrate))}${f('Timecode', i.timecode)}
    ${f('Created', fmtDate(i.file?.created))}${f('Modified', fmtDate(i.file?.modified))}${i.sequence ? f('Sequence', t('{n} frames from {s}, at {f} fps', { n: i.sequence.count, s: i.sequence.start, f: i.sequence.fps })) : ''}${tags(d.format.tags)}</div>`;
  // every stream, in order, with its own facts and tags
  for (const s of d.streams) {
    const kind = { Video: 'Video stream', Audio: 'Sound stream', Subtitle: 'Subtitle stream', Data: 'Data stream', Attachment: 'Attachment' }[s.type] || 'Stream';
    let rows = '';
    const p = s.parts || [];
    if (s.type === 'Video') {
      const col = /^([\w]+)(?:\(([^)]*)\))?/.exec(p[1] || '') || [];
      const cs = (col[2] || '').split(',').map((x) => x.trim());
      const size = /(\d+)x(\d+)/.exec(p.find((x) => /^\d+x\d+/.test(x)) || '');
      const sar = /SAR ([\d:.]+) DAR ([\d:.]+)/.exec(s.line) || [];
      rows += f('Codec', p[0]) + f('Pixel format', col[1]) + (size ? f('Frame', `${size[1]} × ${size[2]}`) : '') + f('Pixel aspect', sar[1]) + f('Display aspect', sar[2]);
      const named = cs.filter((x) => x && !/^(tv|pc|progressive|top first|bottom first|top coded first|bottom coded first)$/.test(x))[0] || '';
      const parts3 = named.split('/');
      rows += f('Range', cs.find((x) => /^(tv|pc)$/.test(x)) === 'pc' ? 'full (pc)' : cs.includes('tv') ? 'limited (tv)' : '');
      if (parts3.length === 3) rows += f('Primaries', parts3[1]) + f('Transfer', parts3[2]) + f('Matrix', parts3[0]); else if (named) rows += f('Colour', named);
      rows += f('interlaced', cs.find((x) => /first/.test(x)) ? cs.find((x) => /first/.test(x)) : '');
      rows += f('Bitrate', (p.find((x) => /kb\/s$/.test(x)) || '')) + f('Rate', (p.find((x) => / fps$/.test(x)) || '')) + f('Frame rate (tbr)', (p.find((x) => / tbr$/.test(x)) || '')) + f('Time base', (p.find((x) => / tbn$/.test(x)) || ''));
    } else if (s.type === 'Audio') {
      rows += f('Codec', p[0]) + f('Rate', p[1]) + f('Sound', p[2]) + f('Sample format', p[3]) + f('Bitrate', p.find((x) => /kb\/s$/.test(x)) || '');
    } else rows += f('Codec', s.line, true);
    rows += f('Flags', s.flags?.join(', ')) + tags(s.tags) + (s.side?.length ? f('Side data', s.side.join('\n'), true) : '');
    html += `<div class="box"><h4>${esc(t(kind))}<small>#${s.index}${s.lang && s.lang !== 'und' ? ` · ${s.lang.toUpperCase()}` : ''}${s.id ? ` · ${s.id}` : ''}</small></h4>${rows}`;
    if (s.type === 'Audio' && i.audio.length > 1) { const n = i.audio.findIndex((a) => a.index === s.index); if (n >= 0) html += `<div class="tracks"><button data-track="${n}" class="${n === cur.track ? 'on' : ''}">${esc(t('Sound track {n}', { n: n + 1 }))}</button></div>`; }
    html += '</div>';
  }
  if (d.chapters.length) html += `<div class="box"><h4>${esc(t('Chapters'))}</h4>${d.chapters.map((c, n) => f(c.tags.title || t('Chapter {n}', { n: n + 1 }), `${fmtClock(c.start)} – ${fmtClock(c.end)}`)).join('')}</div>`;
  html += `<details><summary>${esc(t('Everything ffmpeg says'))}</summary><pre>${esc(i.raw || '')}</pre></details>`;
  box.innerHTML = html;
}
function factsText() {
  if (!cur) return '';
  return `${cur.item.file}\n\n${cur.info.raw || ''}`;
}
$('#copyInfo').addEventListener('click', () => { window.api.copy(factsText()); toast(esc(t('Copied'))); });
$('#revealFile').addEventListener('click', () => { if (cur && !/^https?:/.test(cur.item.file)) window.api.reveal(cur.item.file); });

// ---------- Next and previous, shuffle ----------
function next(n, auto = false) {
  if (!cur) return;
  if (S.shuffle && auto && queue.length > 1) {
    const others = queue.filter((q) => q !== cur.item && !q.bad);
    if (others.length) return load(others[Math.floor(Math.random() * others.length)], { autoplay: true });
  }
  let i = queue.indexOf(cur.item) + n;
  while (queue[i]?.bad && auto) i += n;
  if (queue[i]) load(queue[i], { autoplay: true });
}

// ---------- Small things ----------
function showSpin(on) { $('#spin').hidden = !on; }
let toastTimer = 0;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}
// the segmented choices: which one is on comes from S (or the side tab)
const MIRROR = { fitMode2: 'fitMode', subSize2: 'subSize' };
const SEG_VAL = { sideTab: () => S.sideTab, fitMode: () => S.fitMode, fitMode2: () => S.fitMode, subSize2: () => S.subSize, playQuality: () => String(S.playQuality), brawLook: () => S.brawLook, seqFps: () => String(S.seqFps), jumpSecs: () => String(S.jumpSecs), idleSecs: () => String(S.idleSecs), scopeKind: () => S.scopeKind, cmpMode: () => S.cmpMode };
function placeLenses() {
  for (const seg of $$('.seg')) {
    const id = seg.id;
    const val = SEG_VAL[id] ? SEG_VAL[id]() : String(S[id]);
    let lens = seg.querySelector('.lens');
    if (!lens) { lens = document.createElement('span'); lens.className = 'lens'; seg.prepend(lens); }
    let on = null;
    for (const b of seg.querySelectorAll('button')) { b.classList.toggle('on', b.dataset.v === val); if (b.dataset.v === val) on = b; }
    if (on && on.offsetWidth) { lens.style.left = `${on.offsetLeft}px`; lens.style.width = `${on.offsetWidth}px`; lens.hidden = false; } else lens.hidden = !on;
  }
  for (const [id, key] of [['speedChips', 'speed'], ['aspectChips', 'aspect'], ['zoomChips', 'zoom'], ['chanChips', 'chan']]) {
    for (const b of $(`#${id}`).querySelectorAll('button')) b.classList.toggle('on', +b.dataset.v === +S[key] || b.dataset.v === String(S[key]));
  }
  for (const b of $('#rotChips').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === 'flipH' ? S.flipH : b.dataset.v === 'flipV' ? S.flipV : +b.dataset.v === S.rot);
}
for (const seg of $$('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    const val = b.dataset.v;
    if (seg.id === 'sideTab') { S.sideTab = val; showSideTab(); }
    else if (seg.id === 'fitMode' || seg.id === 'fitMode2') { S.fitMode = val; applyPicture(); }
    else if (seg.id === 'subSize2') { S.subSize = val; applySubSize(); }
    else if (seg.id === 'jumpSecs' || seg.id === 'idleSecs') { S[seg.id] = +val; }
    else if (seg.id === 'playQuality') { S.playQuality = +val; if (cur?.mode === 'transcode') { const at = pos(), p = !v.paused; startAt(main, at, p); } }
    else if (seg.id === 'brawLook') { S.brawLook = val; window.api.brawLook(val); if (cur?.info?.braw) { const at = pos(), p = !v.paused; startAt(main, at, p); } }
    else if (seg.id === 'scopeKind') { S.scopeKind = val; drawScopeNow(); }
    else if (seg.id === 'cmpMode') { S.cmpMode = val; applyCompare(); }
    else if (seg.id === 'seqFps') { S.seqFps = +val; }
    else if (seg.id === 'subSize') { S.subSize = val; applySubSize(); }
    else if (seg.id === 'snapWhere') { S.snapWhere = val; if (val === 'folder') window.api.pickFolder().then((f) => { if (f) S.snapDir = f; else S.snapWhere = 'beside'; save(); showSnapDir(); placeLenses(); }); showSnapDir(); }
    else { S[seg.id] = val; if (seg.id === 'lang') { applyLang(); showUpdate(); } }
    save(); placeLenses();
  });
}
$('#speedChips').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) setSpeed(+b.dataset.v); });
$('#aspectChips').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) { S.aspect = +b.dataset.v; save(); applyPicture(); fitWindow(true); setTimeout(applyPicture, 80); } });
$('#zoomChips').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) { S.zoom = +b.dataset.v; save(); applyPicture(); } });
$('#rotChips').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  if (b.dataset.v === 'flipH') S.flipH = !S.flipH; else if (b.dataset.v === 'flipV') S.flipV = !S.flipV; else S.rot = +b.dataset.v;
  save(); applyPicture(); fitWindow(true);
});
$('#chanChips').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) { S.chan = b.dataset.v; save(); applyAudio(); } });
$('#keepPitch').addEventListener('input', (e) => { S.keepPitch = e.target.checked; v.preservesPitch = S.keepPitch; save(); });
$('#resume').addEventListener('input', (e) => { S.resume = e.target.checked; save(); });
function showSideTab() { for (const [tab, id] of [['queue', 'queueBox'], ['info', 'infoBox'], ['scopes', 'scopesBox'], ['notes', 'notesBox']]) $('#' + id).hidden = S.sideTab !== tab; if (S.sideTab === 'scopes') { drawGop(); drawScopeNow(); } }
function showSide() { setBody('no-side', !S.side); $('#toggleSide').classList.toggle('on', S.side); setTimeout(() => { drawWave(); placeLenses(); placeMask(); fitWindow(false); }, 0); }

// the popovers: one at a time; a click outside closes
const POPS = { speedBtn: 'popSpeed', subsBtn: 'popSubs', pictureBtn: 'popPicture', audioBtn: 'popAudio' };
function closePops() { for (const id of Object.values(POPS)) $('#' + id).hidden = true; for (const b of Object.keys(POPS)) $('#' + b).classList.remove('on'); }
for (const [btn, pop] of Object.entries(POPS)) {
  $('#' + btn).addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('#' + pop).hidden;
    closePops();
    if (open) { $('#' + pop).hidden = false; $('#' + btn).classList.add('on'); if (pop === 'popAudio') drawDevices(); placeLenses(); }
  });
  $('#' + pop).addEventListener('click', (e) => e.stopPropagation());
}
document.addEventListener('click', (e) => { if (!e.target.closest('.pop')) closePops(); });

const KEYS = [
  ['Space', 'Play, pause'], ['J  K  L', 'Back, forward, faster each press; K stops'], ['K + J / L', 'Hold K with J or L: one frame'],
  ['← →', 'One frame back or forward'], ['Shift ← →', 'One second back or forward'], ['Home  End', 'Start, end'],
  ['I  O', 'Mark in, mark out'], ['Shift I  O', 'Go to in, go to out'], ['Alt X', 'Clear in and out'], ['/', 'Play from in to out'],
  ['⌘/Ctrl L', 'Loop'], ['⌘/Ctrl ← →', 'Previous file, next file'], ['Page ↑ ↓', 'Previous chapter, next chapter'], ['↑ ↓', 'Volume up, down'], ['M', 'Sound on or off'],
  ['[  ]', 'Slower, faster'], ['\\', 'Normal speed'], ['S', 'Subtitles on or off'], ['F', 'Full screen'], ['B', 'Small bezel'], ['P', 'Picture in picture'],
  ['⌘/Ctrl Shift S', 'Save the frame as a picture'], ['⌘/Ctrl O', 'Open files'], ['⌘/Ctrl U', 'Open a web address'], ['N', 'Add a marker'], ['1 … 5', 'Rating 1 to 5'],
];
function drawKeys() { $('#keysList').innerHTML = KEYS.map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(t(d))}</span>`).join(''); }

// ---------- Keys ----------
let kDown = false;
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === ',') { e.preventDefault(); return setOpen($('#settings').hidden); }
  if (!$('#settings').hidden) { if (e.key === 'Escape') setOpen(false); return; }
  if (!$('#urlVeil').hidden) { if (e.key === 'Escape') urlOpen(false); if (e.key === 'Enter') urlGo(); return; }
  if (!$('#noteAsk').hidden) return;
  if (e.key === 'Escape') { closePops(); if (document.body.classList.contains('compact')) setCompact(false); return; }
  if (e.target.matches('input, select, textarea')) return;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); return openPick(); }
  if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); return urlOpen(true); }
  if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); return snapshot(); }
  if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); return setLoop(!looping); }
  if (mod && e.key === 'ArrowRight') { e.preventDefault(); return next(1); }
  if (mod && e.key === 'ArrowLeft') { e.preventDefault(); return next(-1); }
  if (mod) return;
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); return togglePlay(); }
  if (k === 'k') { kDown = true; return K(); }
  if (k === 'j') return kDown ? step(-1) : J();
  if (k === 'l') return kDown ? step(1) : L();
  if (e.key === 'ArrowLeft') { e.preventDefault(); return e.shiftKey ? (v.pause(), seek(pos() - S.jumpSecs)) : step(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); return e.shiftKey ? (v.pause(), seek(pos() + S.jumpSecs)) : step(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); return setVolume(S.volume + 0.05); }
  if (e.key === 'ArrowDown') { e.preventDefault(); return setVolume(S.volume - 0.05); }
  if (e.key === 'PageUp') { e.preventDefault(); return chapterStep(-1); }
  if (e.key === 'PageDown') { e.preventDefault(); return chapterStep(1); }
  if (e.key === 'Home') return seek(0);
  if (e.key === 'End') return seek(duration());
  if (k === 'i') return e.shiftKey ? inPt != null && seek(inPt) : mark('in');
  if (k === 'o') return e.shiftKey ? outPt != null && seek(outPt) : mark('out');
  if (k === 'x' && e.altKey) return clearMarks();
  if (e.key === '/') return playRange();
  if (e.key === '[') return speedStep(-1);
  if (e.key === ']') return speedStep(1);
  if (e.key === '\\') return setSpeed(1);
  if (k === 'm') return setMuted(!S.muted);
  if (k === 's') return toggleSubs();
  if (k === 'f') return toggleFull();
  if (k === 'b') return setCompact(!document.body.classList.contains('compact'));
  if (k === 'p') return togglePip();
  if (k === 'n') return askMarker();
  if (/^[1-5]$/.test(e.key)) return setRating(+e.key);
});
document.addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'k') kDown = false; });

// ---------- Buttons ----------
const openPick = async () => add(await window.api.pickFiles(S.lang));
$('#open').addEventListener('click', openPick);
$('#browse').addEventListener('click', openPick);
$('#addMore').addEventListener('click', async () => add(await window.api.pickFiles(S.lang), !cur));
$('#clearQueue').addEventListener('click', () => { queue = queue.filter((q) => q === cur?.item); drawQueue(); });
$('#shuffle').addEventListener('click', () => { S.shuffle = !S.shuffle; save(); drawQueue(); });
$('#saveList').addEventListener('click', async () => { if (!queue.length) return; const p = await window.api.saveList({ files: queue.map((q) => q.file), lang: S.lang }); if (p) toast(esc(t('The list was saved'))); });
$('#play').addEventListener('click', togglePlay);
$('#rew').addEventListener('click', J);
$('#fwd').addEventListener('click', L);
$('#stepBack').addEventListener('click', () => step(-1));
$('#stepFwd').addEventListener('click', () => step(1));
$('#markIn').addEventListener('click', () => mark('in'));
$('#markOut').addEventListener('click', () => mark('out'));
$('#clearIO').addEventListener('click', () => clearMarks());
$('#loop').addEventListener('click', () => setLoop(!looping));
$('#snap').addEventListener('click', snapshot);
$('#full').addEventListener('click', toggleFull);
$('#pip').addEventListener('click', togglePip);
$('#compact').addEventListener('click', () => setCompact(true));
$('#toggleSide').addEventListener('click', () => { S.side = !S.side; save(); showSide(); setTimeout(() => fitWindow(true), 30); });
$('#screen').addEventListener('click', (e) => { if (cur && (e.target === v || e.target.id === 'mask' || e.target.id === 'subs')) togglePlay(); });
$('#screen').addEventListener('dblclick', (e) => { if (cur && e.target === v) toggleFull(); });
$('#queue').addEventListener('click', (e) => {
  const x = e.target.closest('[data-x]');
  if (x) {
    const q = queue[+x.dataset.x];
    queue.splice(+x.dataset.x, 1);
    if (q === cur?.item) { v.pause(); closeMse(main); }
    return drawQueue();
  }
  const li = e.target.closest('li[data-i]');
  if (li) { queue[+li.dataset.i].wasAsked = true; load(queue[+li.dataset.i], { autoplay: true }); }
});
// a web address
function urlOpen(on) { $('#urlVeil').hidden = !on; if (on) { $('#urlField').value = ''; $('#urlField').focus(); } }
function urlGo() { const u = $('#urlField').value.trim(); if (!/^https?:\/\//i.test(u)) return; urlOpen(false); add([u]); }
$('#openUrl').addEventListener('click', () => urlOpen(true));
$('#urlCancel').addEventListener('click', () => urlOpen(false));
$('#urlGo').addEventListener('click', urlGo);
$('#urlVeil').addEventListener('click', (e) => { if (e.target.id === 'urlVeil') urlOpen(false); });
// Open with RoarPlay (Alex, 31 Oct): the kinds in groups with a switch; the Mac is asked first for the general kinds
// (two questions), then only for the kinds it still gives to another app
const EXT_GROUPS = [
  ['video', 'Common video', ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi']],
  ['video', 'Camera and broadcast', ['mxf', 'mts', 'm2ts', 'mpg', 'mpeg', 'ts', 'vob', 'dv', 'dif', 'tod', 'mod', 'm2v', 'mpv', 'qt', 'gif']],
  ['video', 'Web and old video', ['wmv', 'asf', 'flv', 'f4v', '3gp', '3g2', 'ogv', 'rm', 'rmvb', 'divx', 'xvid', 'mjpeg', 'mjpg', 'swf', 'amv', 'nsv', 'evo', 'apng']],
  ['video', 'Raw picture streams', ['h264', '264', 'h265', '265', 'hevc', 'y4m', 'nut', 'ivf']],
  ['audio', 'Music', ['mp3', 'm4a', 'm4b', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wma', 'alac']],
  ['audio', 'Studio sound', ['wav', 'wave', 'bwf', 'aiff', 'aif', 'aifc', 'caf', 'w64', 'rf64']],
  ['audio', 'Cinema sound', ['ac3', 'eac3', 'ec3', 'dts', 'dtshd', 'thd', 'mlp', 'mka']],
  ['audio', 'Other sound', ['adts', 'ape', 'wv', 'tta', 'amr', 'awb', 'au', 'snd', 'mp2', 'mpa', 'mp1', 'ra', 'spx', 'gsm', 'voc', 'mid', 'midi', 'dsf', 'dff', 'tak', 'ofr', 'mpc', 'xm', 's3m', 'it']],
];
let extOn = new Set(fetchStore('defaultExts', EXT_GROUPS.slice(0, 1).concat(EXT_GROUPS.slice(4, 6)).flatMap((g) => g[2])));
let extMine = {}; // ext -> true when the Mac already opens it with RoarPlay
function drawGroups() {
  $('#extGroups').innerHTML = EXT_GROUPS.map(([, name, exts], i) => {
    const on = exts.filter((e) => extOn.has(e)).length, mine = exts.filter((e) => extMine[e]).length;
    const state = mine === exts.length ? `<span class="state all">✓ RoarPlay</span>` : mine ? `<span class="state some">${mine}/${exts.length} RoarPlay</span>` : '<span class="state"></span>';
    return `<div class="grp" data-g="${i}"><div class="grp-row"><span><b>${esc(t(name))}</b><small>${esc(exts.join(' · '))}</small></span>${state}
      <label class="check sm"><input type="checkbox" data-grp="${i}" ${on === exts.length ? 'checked' : ''}></label><button class="ib open" data-open="${i}" aria-label="Kinds"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div>
      <div class="grp-kinds">${exts.map((e) => `<button class="kind-pill ${extOn.has(e) ? 'on' : ''} ${extMine[e] ? 'mine' : ''}" data-ext="${e}"><i></i>${e}</button>`).join('')}</div></div>`;
  }).join('');
}
$('#extGroups').addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]'); if (open) { open.closest('.grp').classList.toggle('open'); return; }
  const pill = e.target.closest('[data-ext]'); if (pill) { const x = pill.dataset.ext; if (extOn.has(x)) extOn.delete(x); else extOn.add(x); store('defaultExts', [...extOn]); const o = pill.closest('.grp').classList.contains('open'); drawGroups(); if (o) $(`.grp[data-g="${pill.closest('.grp').dataset.g}"]`).classList.add('open'); }
});
$('#extGroups').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-grp]'); if (!cb) return;
  for (const x of EXT_GROUPS[+cb.dataset.grp][2]) { if (cb.checked) extOn.add(x); else extOn.delete(x); }
  store('defaultExts', [...extOn]); drawGroups();
});
async function checkDefaults() {
  const r = await window.api.defaultStatus(EXT_GROUPS.flatMap((g) => g[2]));
  if (!r.ok) return;
  extMine = {}; for (const [k, val] of Object.entries(r.map)) extMine[k] = /roarplay/i.test(val);
  drawGroups();
}
$('#defaultCheck').addEventListener('click', checkDefaults);
$('#defaultApply').addEventListener('click', async () => {
  const want = [...extOn]; if (!want.length) return;
  $('#defaultsText').textContent = '…';
  // the general kinds first, then whatever the Mac still gives to another app
  let r = await window.api.setDefault({ broad: true });
  if (r.opened) { $('#defaultsText').textContent = t('Pick RoarPlay in the window that opened.'); return; }
  if (!r.ok) { $('#defaultsText').textContent = `${t('It could not be set')}: ${r.error || ''}`; return; }
  await checkDefaults();
  const left = want.filter((x) => !extMine[x]);
  let done = 0;
  if (left.length) { r = await window.api.setDefault({ exts: left }); if (r.ok) done = r.done; }
  await checkDefaults();
  const mine = want.filter((x) => extMine[x]).length;
  $('#defaultsText').textContent = t('RoarPlay now opens {n} of the {m} kinds you chose.', { n: mine, m: want.length }) + (r.detail ? ` (${r.detail})` : '');
});
drawGroups();

// the tools behind the ⋯ button; the controls fade while it plays and the mouse rests
$('#moreBtn').addEventListener('click', (e) => { e.stopPropagation(); setBody('more-open', !document.body.classList.contains('more-open')); placeLenses(); });
$('#quiet').checked = S.quiet; setBody('quiet', S.quiet);
$('#quiet').addEventListener('input', (e) => { S.quiet = e.target.checked; save(); setBody('quiet', S.quiet); });

// ---------- Drop anywhere ----------
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; setBody('dragging', true); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; setBody('dragging', false); } });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; setBody('dragging', false);
  const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean);
  const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (!paths.length && /^https?:\/\/\S+$/i.test((text || '').trim())) return add([text.trim()]);
  add(paths);
});
window.api.onOpenFiles((list) => add(list));

// ---------- Updates and the Settings window (as in RoarMorph) ----------
let upd = { status: 'idle' };
let appVersion = '';
const clock = (ms) => new Date(ms).toLocaleTimeString(S.lang === 'el' ? 'el-GR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
function showUpdate(u) {
  upd = u || upd;
  $('#update').hidden = upd.status !== 'ready';
  $('#updRestart').hidden = upd.status !== 'ready';
  $('#updCheck').hidden = upd.status === 'ready';
  $('#updCheck').disabled = upd.status === 'checking' || upd.status === 'downloading';
  $('#updName').textContent = appVersion ? `RoarPlay ${appVersion}` : 'RoarPlay';
  $('#updStatus').textContent =
    upd.status === 'checking' ? t('Looking for a new version…')
    : upd.status === 'downloading' ? t('Bringing {v}: {p}%', { v: upd.version, p: upd.progress || 0 })
    : upd.status === 'ready' ? t('{v} is ready: restart to put it in.', { v: upd.version })
    : upd.status === 'error' ? t('Could not look just now ({e}). It tries again by itself.', { e: upd.error || '' })
    : upd.checkedAt ? t('Up to date · looked at {time}', { time: clock(upd.checkedAt) })
    : S.autoUpdate ? t('Up to date. It looks by itself.') : t('Up to date.');
}
window.api.version().then((x) => { appVersion = x || ''; $('#ver2').textContent = x ? `v${x}` : ''; showUpdate(); }).catch(() => {});
window.api.update.state().then(showUpdate);
window.api.update.on(showUpdate);
window.api.update.auto(S.autoUpdate);
$('#autoUpdate').checked = S.autoUpdate;
$('#autoUpdate').addEventListener('input', (e) => { S.autoUpdate = e.target.checked; save(); window.api.update.auto(S.autoUpdate); showUpdate(); });
$('#update').addEventListener('click', () => window.api.update.install());
$('#updRestart').addEventListener('click', () => window.api.update.install());
$('#updCheck').addEventListener('click', () => { showUpdate({ ...upd, status: 'checking' }); window.api.update.check().then(showUpdate); });
const setOpen = (on) => { $('#settings').hidden = !on; if (on) { showUpdate(); placeLenses(); drawDevices(); if (platform === 'darwin') checkDefaults(); $('#closeSettings').focus(); } };
function showPage(name) {
  for (const b of $$('.set-nav button[data-page]')) b.classList.toggle('on', b.dataset.page === name);
  for (const p of $$('.set-page')) p.hidden = p.dataset.page !== name;
  placeLenses();
}
$('.set-nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-page]'); if (b) showPage(b.dataset.page); });
$('#openSettings').addEventListener('click', () => setOpen(true));
$('#closeSettings').addEventListener('click', () => setOpen(false));
$('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') setOpen(false); });

// ---------- The professional side (0.3, Alex 31 Oct): meters and loudness, scopes, GOP, QC, notes, LUT, compare ----------

// --- the sound's meters (sample peak per channel) and loudness (EBU R128, in src/lufs-worklet.js)
let tap = null; // { analysers: [], data, worklet }
const lufs = { m: [], s: [], all: [], peak: -Infinity, gateBlocks: [] };
async function tapAudio() {
  if (!audio || tap) return;
  const { ctx, src, N } = audio;
  const splitter = ctx.createChannelSplitter(N);
  src.connect(splitter);
  const analysers = [];
  const sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
  for (let c = 0; c < N; c++) { const a = ctx.createAnalyser(); a.fftSize = 1024; splitter.connect(a, c); a.connect(sink); analysers.push(a); }
  tap = { analysers, data: new Float32Array(1024), worklet: null };
  try {
    await ctx.audioWorklet.addModule('lufs-worklet.js');
    const node = new AudioWorkletNode(ctx, 'lufs', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
    // the loudness is measured on what is heard: the stereo after the downmix (before the equalizer)
    audio.merger.connect(node);
    node.port.onmessage = (e) => onLufsBlock(e.data);
    tap.worklet = node;
  } catch (e) { console.warn('lufs worklet', e); }
}
// a 100 ms block from the worklet: mean square per channel (K-weighted) and sample peaks
function onLufsBlock({ ms, peak }) {
  if (v.paused) return;
  const power = ms.reduce((a, b) => a + b, 0);
  lufs.m.push(power); if (lufs.m.length > 4) lufs.m.shift();
  lufs.s.push(power); if (lufs.s.length > 30) lufs.s.shift();
  lufs.all.push(power); if (lufs.all.length > 36000) lufs.all.shift();
  lufs.peak = Math.max(lufs.peak, ...peak.map((x) => 20 * Math.log10(x || 1e-9)));
  const L = (arr) => { const p = arr.reduce((a, b) => a + b, 0) / (arr.length || 1); return p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity; };
  const M = L(lufs.m), Sv = L(lufs.s);
  // integrated: 400 ms blocks over the whole, gated at −70 LUFS and then 10 LU under the ungated mean
  let I = -Infinity, LRA = 0;
  if (lufs.all.length >= 4) {
    const blocks = [];
    for (let i = 3; i < lufs.all.length; i++) { const p = (lufs.all[i] + lufs.all[i - 1] + lufs.all[i - 2] + lufs.all[i - 3]) / 4; if (p > 0) blocks.push(-0.691 + 10 * Math.log10(p)); }
    const abs = blocks.filter((x) => x > -70);
    if (abs.length) {
      const mean = (xs) => -0.691 + 10 * Math.log10(xs.reduce((a, x) => a + Math.pow(10, (x + 0.691) / 10), 0) / xs.length);
      const rel = mean(abs) - 10;
      const kept = abs.filter((x) => x > rel);
      if (kept.length) I = mean(kept);
      // the range: the 3 s blocks between the 10th and the 95th percentile, gated at −20 under the mean
      const shorts = []; for (let i = 29; i < lufs.all.length; i += 10) { let p = 0; for (let j = i - 29; j <= i; j++) p += lufs.all[j]; p /= 30; if (p > 0) shorts.push(-0.691 + 10 * Math.log10(p)); }
      const sa = shorts.filter((x) => x > -70); if (sa.length > 1) { const r = mean(sa) - 20; const g = sa.filter((x) => x > r).sort((a, b) => a - b); if (g.length > 1) LRA = g[Math.floor(0.95 * (g.length - 1))] - g[Math.floor(0.1 * (g.length - 1))]; }
    }
  }
  const f = (x) => (isFinite(x) && x > -90 ? x.toFixed(1) : '−∞');
  $('#lufsM').textContent = f(M); $('#lufsS').textContent = f(Sv); $('#lufsI').textContent = f(I); $('#lufsR').textContent = LRA.toFixed(1); $('#lufsP').textContent = f(lufs.peak);
}
function resetLufs() { lufs.m = []; lufs.s = []; lufs.all = []; lufs.peak = -Infinity; for (const id of ['lufsM', 'lufsS', 'lufsI', 'lufsP']) $('#' + id).textContent = '−∞'; $('#lufsR').textContent = '0'; }
$('#lufsReset').addEventListener('click', resetLufs);
const CH_NAMES = ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'];
const peakHold = [];
function drawMeters() {
  const ch = cur?.info?.audio?.[cur?.track]?.channels || '';
  const n = /5\.1|6\.1|7\.1|6 ch|8 ch/.test(ch) ? 6 : /mono|1 ch/.test(ch) ? 1 : 2;
  $('#meters').innerHTML = [...Array(n)].map((_, c) => `<div class="meter" data-c="${c}"><small>${n === 1 ? 'M' : CH_NAMES[c]}</small><div class="bar"><div class="lvl"></div><div class="pk"></div></div><b>−∞</b></div>`).join('');
}
function paintMeters() {
  if (!tap || !cur || $('#scopesBox').hidden) return;
  const rows = $$('#meters .meter');
  for (const row of rows) {
    const c = +row.dataset.c;
    const a = tap.analysers[c]; if (!a) continue;
    a.getFloatTimeDomainData(tap.data);
    let peak = 0; for (let i = 0; i < tap.data.length; i++) { const x = Math.abs(tap.data[i]); if (x > peak) peak = x; }
    const db = 20 * Math.log10(peak || 1e-6);
    const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    peakHold[c] = Math.max(pct, (peakHold[c] || 0) - 0.6);
    row.querySelector('.lvl').style.width = `${pct}%`;
    row.querySelector('.pk').style.left = `${peakHold[c]}%`;
    row.querySelector('b').textContent = db > -60 ? db.toFixed(1) : '−∞';
    row.classList.toggle('clip', db > -0.3);
  }
}

// --- the picture's scopes, from a small copy of the frame on screen
const scopeSrc = document.createElement('canvas'); scopeSrc.width = 192; scopeSrc.height = 108;
let scopeBusy = false;
function drawScopeNow() {
  if ($('#scopesBox').hidden || S.scopeKind === 'off' || !cur || !hasPicture() || !v.videoWidth) return;
  const g = scopeSrc.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(v, 0, 0, scopeSrc.width, scopeSrc.height); } catch { return; }
  const px = g.getImageData(0, 0, scopeSrc.width, scopeSrc.height).data;
  const c = $('#scope'); const W = c.width, H = c.height; const o = c.getContext('2d');
  o.fillStyle = '#0b0c0f'; o.fillRect(0, 0, W, H);
  const sw = scopeSrc.width, sh = scopeSrc.height;
  if (S.scopeKind === 'waveform' || S.scopeKind === 'parade') {
    const img = o.createImageData(W, H); const d = img.data;
    const cols = S.scopeKind === 'parade' ? 3 : 1;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4; const r = px[i], gg = px[i + 1], b = px[i + 2];
      const vals = cols === 1 ? [0.2126 * r + 0.7152 * gg + 0.0722 * b] : [r, gg, b];
      for (let k = 0; k < cols; k++) {
        const X = Math.floor((x / sw) * (W / cols) + k * (W / cols)); const Y = H - 1 - Math.floor((vals[k] / 255) * (H - 1));
        const j = (Y * W + X) * 4;
        if (cols === 1) { d[j] = Math.min(255, d[j] + 40); d[j + 1] = Math.min(255, d[j + 1] + 70); d[j + 2] = Math.min(255, d[j + 2] + 40); }
        else { d[j + k] = Math.min(255, d[j + k] + 60); }
        d[j + 3] = 255;
      }
    }
    o.putImageData(img, 0, 0);
    o.strokeStyle = 'rgba(255,255,255,.18)'; o.lineWidth = 1;
    for (const lvl of [0, 0.25, 0.5, 0.75, 1]) { const y = Math.round(H - 1 - lvl * (H - 1)) + 0.5; o.beginPath(); o.moveTo(0, y); o.lineTo(W, y); o.stroke(); }
    o.fillStyle = 'rgba(255,255,255,.5)'; o.font = '9px ui-monospace, Menlo, monospace'; o.fillText('100', 3, 10); o.fillText('0', 3, H - 3);
  } else if (S.scopeKind === 'vector') {
    const img = o.createImageData(W, H); const d = img.data; const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 4;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
      const cb = -0.1146 * r - 0.3854 * gg + 0.5 * b, cr = 0.5 * r - 0.4542 * gg - 0.0458 * b;
      const X = Math.round(cx + cb * 2 * R), Y = Math.round(cy - cr * 2 * R);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const j = (Y * W + X) * 4; d[j] = Math.min(255, d[j] + 50); d[j + 1] = Math.min(255, d[j + 1] + 90); d[j + 2] = Math.min(255, d[j + 2] + 50); d[j + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    o.strokeStyle = 'rgba(255,255,255,.2)'; o.beginPath(); o.arc(cx, cy, R, 0, Math.PI * 2); o.stroke(); o.beginPath(); o.moveTo(cx - R, cy); o.lineTo(cx + R, cy); o.moveTo(cx, cy - R); o.lineTo(cx, cy + R); o.stroke();
    // the 75% targets of the colour bars
    o.fillStyle = 'rgba(255,255,255,.6)'; o.font = '9px ui-monospace, Menlo, monospace';
    for (const [name, r, gg, b] of [['R', 0.75, 0, 0], ['Yl', 0.75, 0.75, 0], ['G', 0, 0.75, 0], ['Cy', 0, 0.75, 0.75], ['B', 0, 0, 0.75], ['Mg', 0.75, 0, 0.75]]) {
      const cb = -0.1146 * r - 0.3854 * gg + 0.5 * b, cr = 0.5 * r - 0.4542 * gg - 0.0458 * b;
      const X = cx + cb * 2 * R, Y = cy - cr * 2 * R; o.strokeRect(X - 3, Y - 3, 6, 6); o.fillText(name, X + 5, Y + 3);
    }
  } else if (S.scopeKind === 'histogram') {
    const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    for (let i = 0; i < px.length; i += 4) { h[0][px[i]]++; h[1][px[i + 1]]++; h[2][px[i + 2]]++; }
    const max = Math.max(...h.map((a) => Math.max(...a))) || 1;
    o.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { o.fillStyle = ['rgba(255,60,60,.7)', 'rgba(60,255,60,.7)', 'rgba(80,120,255,.7)'][k]; for (let x = 0; x < 256; x++) { const hh = (h[k][x] / max) * (H - 4); o.fillRect((x / 256) * W, H - hh, W / 256 + 0.5, hh); } }
    o.globalCompositeOperation = 'source-over';
  }
}
setInterval(() => { if (!v.paused || scopeBusy === false) { drawScopeNow(); scopeBusy = true; } paintMeters(); }, 100);
v.addEventListener('seeked', () => { scopeBusy = false; });

// --- the GOP strip, the bitrate and the keyframes on the bar, from the packets read once
let packetsOf = null, scanning = false;
async function scanPackets() {
  if (!cur || !hasPicture() || scanning || packetsOf) return;
  scanning = true; $('#scanBtn').disabled = true;
  const item = cur.item;
  const pk = await window.api.packets({ file: item.file, info: cur.info });
  scanning = false; $('#scanBtn').disabled = false;
  if (cur?.item !== item) return;
  packetsOf = pk;
  drawGop(); drawKeyTicks();
}
window.api.onScanProgress(({ file, p }) => { if (cur && cur.item.file === file) $('#scanBtn').textContent = `${Math.round(p * 100)}%`; });
$('#scanBtn').addEventListener('click', scanPackets);
function drawGop() {
  const c = $('#gop'), o = c.getContext('2d'), W = c.width, H = c.height;
  const b = $('#brate'), ob = b.getContext('2d');
  o.fillStyle = '#0b0c0f'; o.fillRect(0, 0, W, H); ob.fillStyle = '#0b0c0f'; ob.fillRect(0, 0, b.width, b.height);
  $('#scanBtn').textContent = t('Read the packets');
  $('#scanBtn').hidden = !!packetsOf; $('#keyTicks').parentElement.hidden = !packetsOf;
  if (!packetsOf || !cur) { $('#gopSummary').textContent = ''; return; }
  const pk = packetsOf, f = fps();
  const sum = pk.sum || (pk.sum = (() => { const kf = pk.k.reduce((a, x) => a + x, 0); return { frames: pk.t.length, keyframes: kf, bframes: pk.b.reduce((a, x) => a + x, 0), gopAvg: kf ? pk.t.length / kf : 0 }; })());
  $('#gopSummary').textContent = `${sum.keyframes} I · ${sum.bframes} B · GOP ≈ ${sum.gopAvg.toFixed(1)}`;
  // the frames around the playhead: ±2 s, I tall and red, B short and blue, P between
  const span = 2, t0 = shownTime - span, t1 = shownTime + span;
  const i0 = lowerBound(pk.t, t0), i1 = lowerBound(pk.t, t1);
  const n = Math.max(1, i1 - i0);
  const fw = Math.max(1, W / (span * 2 * f));
  for (let i = i0; i < i1 && i < pk.t.length; i++) {
    const x = ((pk.t[i] - t0) / (span * 2)) * W;
    const kind = pk.k[i] ? 'I' : pk.b[i] ? 'B' : 'P';
    const h = kind === 'I' ? H - 6 : kind === 'P' ? (H - 6) * 0.6 : (H - 6) * 0.35;
    o.fillStyle = kind === 'I' ? '#ff3b30' : kind === 'P' ? 'rgba(255,255,255,.55)' : 'rgba(110,160,255,.8)';
    o.fillRect(x, H - 3 - h, Math.max(1, fw - 1), h);
  }
  o.fillStyle = '#fff'; o.fillRect(W / 2 - 1, 0, 2, H);
  // the bitrate over the whole file, one bar a second
  const d = duration() || pk.t[pk.t.length - 1] || 1;
  const bins = Math.min(b.width, Math.ceil(d));
  const kb = new Float64Array(bins);
  for (let i = 0; i < pk.t.length; i++) { const k = Math.min(bins - 1, Math.floor((pk.t[i] / d) * bins)); kb[k] += pk.s[i] * 8 / 1000 / (d / bins); }
  const max = Math.max(...kb) || 1;
  ob.fillStyle = 'rgba(255,255,255,.45)';
  for (let k = 0; k < bins; k++) { const h = (kb[k] / max) * (b.height - 12); ob.fillRect((k / bins) * b.width, b.height - h, Math.max(1, b.width / bins), h); }
  ob.fillStyle = '#ff3b30'; ob.fillRect((shownTime / d) * b.width - 1, 0, 2, b.height);
  ob.fillStyle = 'rgba(255,255,255,.6)'; ob.font = '9px ui-monospace, Menlo, monospace'; ob.fillText(`${(max / 1000).toFixed(1)} Mb/s`, 3, 10);
}
function lowerBound(arr, x) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; }
function drawKeyTicks() {
  for (const el of $$('.bar .kf')) el.remove();
  if (!S.keyTicks || !packetsOf || !duration()) return;
  const d = duration(); const keys = [];
  for (let i = 0; i < packetsOf.t.length; i++) if (packetsOf.k[i]) keys.push(packetsOf.t[i]);
  const step = Math.max(1, Math.ceil(keys.length / 400));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < keys.length; i += step) { const e = document.createElement('i'); e.className = 'kf'; e.style.left = `${(keys[i] / d) * 100}%`; frag.append(e); }
  $('#chaps').append(frag);
}
$('#keyTicks').addEventListener('input', (e) => { S.keyTicks = e.target.checked; save(); drawKeyTicks(); });
$('#keyTicks').checked = S.keyTicks;
setInterval(() => { if (!$('#scopesBox').hidden && packetsOf && !v.paused) drawGop(); }, 200);
v.addEventListener('seeked', () => { if (!$('#scopesBox').hidden) drawGop(); });

// --- the QC report: ffmpeg's checks on the whole file, with the loudness, and what the packets say
let qcOf = null, qcRunning = false;
const QC_KIND = { black: ['Black', '#333'], freeze: ['Frozen', '#8fb4ff'], silence: ['Silence', '#ffb224'], decode: ['Decode error', '#ff3b30'], gap: ['Missing frames', '#ff3b30'] };
async function runQc() {
  if (!cur || qcRunning) return;
  qcRunning = true; $('#qcBtn').disabled = true; $('#qcProg').textContent = '0%';
  const item = cur.item;
  const [r] = await Promise.all([window.api.qc({ file: item.file, info: cur.info }), packetsOf || !hasPicture() ? Promise.resolve() : scanPackets()]);
  qcRunning = false; $('#qcBtn').disabled = false; $('#qcProg').textContent = '';
  if (cur?.item !== item) return;
  const pf = packetsOf ? packetFindingsLocal(packetsOf, fps()) : [];
  qcOf = { findings: [...r.findings, ...pf].sort((a, b) => (a.t ?? -1) - (b.t ?? -1)), summary: { ...r.summary, ...(pf.summary || {}) }, error: r.error };
  drawQc();
}
function packetFindingsLocal(pk, f) {
  const out = []; if (!pk || pk.t.length < 2 || !f) return out;
  const step = 1 / f;
  for (let i = 1; i < pk.t.length; i++) { const gap = pk.t[i] - pk.t[i - 1]; if (gap > step * 1.5 && gap < 3600) out.push({ kind: 'gap', t: pk.t[i - 1], end: pk.t[i], text: String(Math.round(gap / step) - 1) }); }
  const kf = pk.k.reduce((a, x) => a + x, 0);
  out.summary = { frames: pk.t.length, keyframes: kf, gopAvg: kf ? pk.t.length / kf : 0 };
  return out;
}
window.api.onQcProgress(({ file, p }) => { if (cur && cur.item.file === file) $('#qcProg').textContent = `${Math.round(p * 100)}%`; });
$('#qcBtn').addEventListener('click', runQc);
function drawQc() {
  const sum = $('#qcSum'), list = $('#qcList');
  $('#qcSave').hidden = !qcOf;
  if (!qcOf) { sum.innerHTML = ''; list.innerHTML = ''; return; }
  const s = qcOf.summary;
  const row = (k, val, bad) => (val == null || val === '' ? '' : `<span>${esc(t(k))}</span><b class="${bad ? 'bad' : ''}">${esc(val)}</b>`);
  sum.innerHTML = row('Integrated', s.integrated != null ? `${s.integrated.toFixed(1)} LUFS` : null, s.integrated != null && (s.integrated > -14 || s.integrated < -27))
    + row('Loudness range', s.range != null ? `${s.range.toFixed(1)} LU` : null) + row('True peak', s.truePeak != null ? `${s.truePeak.toFixed(1)} dBTP` : null, s.truePeak != null && s.truePeak > -1)
    + row('Frames', s.frames) + row('Keyframes', s.keyframes) + row('GOP', s.gopAvg ? s.gopAvg.toFixed(1) : null);
  const F = qcOf.findings;
  if (!F.length) { list.innerHTML = `<div class="ok">✓ ${esc(t('Nothing found: no black, no frozen picture, no silence, no missing frames, no decode errors.'))}</div>`; return; }
  list.innerHTML = F.map((x, i) => { const [name, col] = QC_KIND[x.kind] || [x.kind, '#aaa']; return `<button data-q="${i}" style="--c:${col}"><small>${x.t != null ? esc(clockText(x.t)) : '—'}</small><span><i></i> ${esc(t(name))}${x.n > 1 ? ` ×${x.n}` : ''}</span><small>${esc(x.text || '')}</small></button>`; }).join('')
    + (s.truncated ? `<div class="ok">…</div>` : '');
}
$('#qcList').addEventListener('click', (e) => { const b = e.target.closest('button[data-q]'); if (!b || !qcOf) return; const x = qcOf.findings[+b.dataset.q]; if (x && x.t != null) { v.pause(); seek(x.t); } });
$('#qcSave').addEventListener('click', async () => {
  if (!qcOf || !cur) return;
  const s = qcOf.summary;
  const lines = [`RoarPlay QC report`, cur.item.file, new Date().toLocaleString(), '', `Integrated loudness: ${s.integrated != null ? s.integrated.toFixed(1) + ' LUFS' : '-'}`, `Loudness range: ${s.range != null ? s.range.toFixed(1) + ' LU' : '-'}`, `True peak: ${s.truePeak != null ? s.truePeak.toFixed(1) + ' dBTP' : '-'}`,
    `Frames: ${s.frames ?? '-'} · Keyframes: ${s.keyframes ?? '-'} · GOP: ${s.gopAvg ? s.gopAvg.toFixed(1) : '-'}`, '', ...(qcOf.findings.length ? qcOf.findings.map((x) => `${x.t != null ? clockText(x.t) : '--:--:--:--'}  ${(QC_KIND[x.kind] || [x.kind])[0]}${x.n > 1 ? ` x${x.n}` : ''}  ${x.text || ''}`) : ['Nothing found.'])];
  const p = await window.api.saveText({ name: `${cur.item.name} QC.txt`, text: lines.join('\n') + '\n', ext: 'txt', lang: S.lang });
  if (p) toast(esc(t('Saved {name}', { name: p.split(/[\\/]/).pop() })));
});

// --- notes: a rating and markers per file, kept on this computer, saved out as CSV or EDL
const notes = fetchStore('notes', {});
const noteOf = () => (cur ? (notes[cur.item.file] ||= { rating: 0, marks: [] }) : null);
const saveNotes = () => store('notes', notes);
function drawNotes() {
  const n = noteOf();
  for (const b of $$('#stars button[data-r]')) b.classList.toggle('on', !!n && +b.dataset.r > 0 && +b.dataset.r <= n.rating);
  const box = $('#marks');
  box.innerHTML = n ? n.marks.map((m, i) => `<div><b data-go="${i}">${esc(clockText(m.t))}</b><input data-i="${i}" value="${esc(m.text)}" placeholder="…"><button class="ib" data-del="${i}" aria-label="Remove">${X}</button></div>`).join('') : '';
  for (const el of $$('.bar .mk')) el.remove();
  const d = duration();
  if (n && d) { const frag = document.createDocumentFragment(); for (const m of n.marks) { const e = document.createElement('i'); e.className = 'mk'; e.style.left = `${(m.t / d) * 100}%`; e.title = m.text; frag.append(e); } $('#chaps').append(frag); }
}
$('#stars').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); const n = noteOf(); if (!b || !n) return; n.rating = +b.dataset.r; saveNotes(); drawNotes(); });
function setRating(r) { const n = noteOf(); if (!n) return; n.rating = n.rating === r ? 0 : r; saveNotes(); drawNotes(); toast('★'.repeat(n.rating) || '—'); }
function askMarker() {
  if (!cur) return;
  const at = shownTime;
  $('#noteAsk').hidden = false; $('#noteField').value = ''; $('#noteField').dataset.t = at; $('#noteField').focus();
}
function addMarker() {
  const n = noteOf(); if (!n) return;
  n.marks.push({ t: +$('#noteField').dataset.t, text: $('#noteField').value.trim() });
  n.marks.sort((a, b) => a.t - b.t);
  saveNotes(); drawNotes(); $('#noteAsk').hidden = true;
}
$('#noteSave').addEventListener('click', addMarker);
$('#noteCancel').addEventListener('click', () => { $('#noteAsk').hidden = true; });
$('#noteField').addEventListener('keydown', (e) => { if (e.key === 'Enter') addMarker(); if (e.key === 'Escape') $('#noteAsk').hidden = true; e.stopPropagation(); });
$('#marks').addEventListener('click', (e) => {
  const n = noteOf(); if (!n) return;
  const go = e.target.closest('[data-go]'); if (go) { v.pause(); seek(n.marks[+go.dataset.go].t); return; }
  const del = e.target.closest('[data-del]'); if (del) { n.marks.splice(+del.dataset.del, 1); saveNotes(); drawNotes(); }
});
$('#marks').addEventListener('input', (e) => { const n = noteOf(); const i = e.target.dataset.i; if (n && i != null) { n.marks[+i].text = e.target.value; saveNotes(); } });
$('#notesClear').addEventListener('click', () => { const n = noteOf(); if (!n) return; n.marks = []; n.rating = 0; saveNotes(); drawNotes(); });
const csvCell = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
$('#notesCsv').addEventListener('click', async () => {
  const n = noteOf(); if (!n) return;
  const rows = [['File', 'Rating', 'Timecode', 'Time', 'Frame', 'Note'].map(csvCell).join(',')];
  const base = cur.info.timecode || '00:00:00:00', f = fps(), drop = isDrop(f, base);
  for (const m of n.marks) rows.push([cur.item.name, n.rating, framesToTc(tcToFrames(base, f, drop) + Math.max(0, frameOf(m.t)), f, drop), fmtTime(m.t), frameOf(m.t), m.text].map(csvCell).join(','));
  if (!n.marks.length) rows.push([cur.item.name, n.rating, '', '', '', ''].map(csvCell).join(','));
  const p = await window.api.saveText({ name: `${cur.item.name} notes.csv`, text: '﻿' + rows.join('\r\n') + '\r\n', ext: 'csv', lang: S.lang });
  if (p) toast(esc(t('Saved {name}', { name: p.split(/[\\/]/).pop() })));
});
// an EDL with marker comments, as DaVinci Resolve imports them (Timeline > Import > Timeline markers from EDL)
$('#notesEdl').addEventListener('click', async () => {
  const n = noteOf(); if (!n) return;
  const base = cur.info.timecode || '01:00:00:00', f = fps(), drop = isDrop(f, base);
  const tc = (tm) => framesToTc(tcToFrames(base, f, drop) + Math.max(0, frameOf(tm)), f, drop).replace(';', ':');
  const lines = [`TITLE: ${cur.item.name}`, `FCM: ${drop ? 'DROP FRAME' : 'NON-DROP FRAME'}`, ''];
  n.marks.forEach((m, i) => {
    const a = tc(m.t), b = framesToTc(tcToFrames(base, f, drop) + Math.max(0, frameOf(m.t)) + 1, f, drop).replace(';', ':');
    lines.push(`${String(i + 1).padStart(3, '0')}  001      V     C        ${a} ${b} ${a} ${b}`, `* FROM CLIP NAME: ${cur.item.name}`, ` |C:ResolveColorBlue |M:${m.text || 'Marker'} |D:1`, '');
  });
  const p = await window.api.saveText({ name: `${cur.item.name} markers.edl`, text: lines.join('\r\n'), ext: 'edl', lang: S.lang });
  if (p) toast(esc(t('Saved {name}', { name: p.split(/[\\/]/).pop() })));
});

// --- a LUT (.cube) on the picture, through WebGL: the video drawn into a canvas with a 3D texture lookup
let gl = null, lutCur = null;
const glc = $('#glc');
function glInit() {
  if (gl) return gl;
  const g = glc.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!g) return null;
  const vs = `#version 300 es\nin vec2 p; out vec2 uv; void main(){ uv = vec2(p.x, 1.0 - p.y); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const fs = `#version 300 es\nprecision highp float; precision highp sampler3D; in vec2 uv; out vec4 o; uniform sampler2D tex; uniform sampler3D lut; uniform float mix1; uniform float size; uniform vec3 dmin; uniform vec3 dmax;
    void main(){ vec4 c = texture(tex, uv); vec3 n = clamp((c.rgb - dmin) / (dmax - dmin), 0.0, 1.0); vec3 q = n * (size - 1.0) / size + 0.5 / size; vec3 l = texture(lut, q).rgb; o = vec4(mix(c.rgb, l, mix1), 1.0); }`;
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
  const prog = g.createProgram(); g.attachShader(prog, sh(g.VERTEX_SHADER, vs)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(prog); g.useProgram(prog);
  const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const tex = g.createTexture(); g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex);
  for (const [k, val] of [[g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE], [g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR]]) g.texParameteri(g.TEXTURE_2D, k, val);
  const lutTex = g.createTexture(); g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_3D, lutTex);
  for (const [k, val] of [[g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_R, g.CLAMP_TO_EDGE], [g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR]]) g.texParameteri(g.TEXTURE_3D, k, val);
  g.uniform1i(g.getUniformLocation(prog, 'tex'), 0); g.uniform1i(g.getUniformLocation(prog, 'lut'), 1);
  gl = { g, prog, u: { mix: g.getUniformLocation(prog, 'mix1'), size: g.getUniformLocation(prog, 'size'), dmin: g.getUniformLocation(prog, 'dmin'), dmax: g.getUniformLocation(prog, 'dmax') } };
  return gl;
}
function setLut(r) {
  if (!r || !r.lut) { lutCur = null; S.lutFile = ''; save(); applyLut(); return; }
  let lut = r.lut;
  // a 1D LUT becomes a small 3D one, each axis through its own curve
  if (lut.dim === 1) {
    const n = lut.size, data = [];
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r2 = 0; r2 < n; r2++) data.push(lut.data[r2 * 3], lut.data[g * 3 + 1], lut.data[b * 3 + 2]);
    lut = { ...lut, dim: 3, data };
  }
  lutCur = { ...lut, file: r.file, name: r.file.split(/[\\/]/).pop() };
  S.lutFile = r.file; save();
  const G = glInit();
  if (!G) { toast('WebGL is not available'); lutCur = null; return; }
  const g = G.g;
  g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_3D, g.getParameter(g.TEXTURE_BINDING_3D));
  const n = lut.size ** 3, bytes = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { bytes[i * 4] = Math.round(Math.max(0, Math.min(1, lut.data[i * 3])) * 255); bytes[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, lut.data[i * 3 + 1])) * 255); bytes[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, lut.data[i * 3 + 2])) * 255); bytes[i * 4 + 3] = 255; }
  g.texImage3D(g.TEXTURE_3D, 0, g.RGBA8, lut.size, lut.size, lut.size, 0, g.RGBA, g.UNSIGNED_BYTE, bytes);
  g.uniform1f(G.u.size, lut.size); g.uniform3fv(G.u.dmin, lut.min); g.uniform3fv(G.u.dmax, lut.max);
  applyLut();
}
function applyLut() {
  const on = !!lutCur && hasPicture();
  glc.hidden = !on;
  v.style.opacity = on ? '0' : '';
  $('#lutName').textContent = lutCur ? lutCur.name : '';
  $('#lutOff').hidden = !lutCur; $('#lutMixRow').hidden = !lutCur;
  $('#lutMix').value = S.lutMix; $('#lutMix').style.setProperty('--p', `${S.lutMix * 100}%`);
  $('#pictureBtn').classList.toggle('lit', $('#pictureBtn').classList.contains('lit') || !!lutCur);
  if (on) { glc.style.transform = v.style.transform; glc.style.filter = v.style.filter; glc.style.objectFit = S.fitMode; drawLutFrame(); }
}
function drawLutFrame() {
  if (!lutCur || !gl || !v.videoWidth || glc.hidden) return;
  const g = gl.g;
  if (glc.width !== v.videoWidth || glc.height !== v.videoHeight) { glc.width = v.videoWidth; glc.height = v.videoHeight; g.viewport(0, 0, glc.width, glc.height); }
  g.activeTexture(g.TEXTURE0);
  try { g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, v); } catch { return; }
  g.uniform1f(gl.u.mix, S.lutMix);
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
}
function watchLut() { v.requestVideoFrameCallback(() => { drawLutFrame(); watchLut(); }); }
watchLut();
v.addEventListener('seeked', () => setTimeout(drawLutFrame, 30));
$('#lutPick').addEventListener('click', async () => { const r = await window.api.pickLut(); if (!r) return; if (r.error) return toast(esc(r.error)); setLut(r); });
$('#lutOff').addEventListener('click', () => setLut(null));
$('#lutMix').addEventListener('input', (e) => { S.lutMix = +e.target.value; save(); applyLut(); });

// --- compare: a second file over the first, cut by a wipe or side by side, following the first's clock
async function setCompare(file) {
  closeMse(B);
  B.cur = null; B.v.removeAttribute('src'); B.v.load(); B.offset = 0;
  if (!file) { applyCompare(); return; }
  const r = await window.api.probe(file, { fps: S.seqFps });
  if (r.plan.mode === 'none' || !r.info.video) { toast(esc(t('The second file cannot be played here'))); applyCompare(); return; }
  B.cur = { item: { file, name: file.split(/[\\/]/).pop(), url: r.url, mime: r.mime }, info: r.info, plan: r.plan, mode: r.plan.mode, track: 0 };
  applyCompare();
  await startAt(B, Math.max(0, pos() + B.offset), !v.paused);
}
function applyCompare() {
  const on = !!B.cur;
  $('#cmp').hidden = !on;
  $('#cmp').classList.toggle('wipe-mode', S.cmpMode === 'wipe'); $('#cmp').classList.toggle('side-mode', S.cmpMode === 'side');
  setBody('cmp-side', on && S.cmpMode === 'side');
  $('#cmpName').textContent = on ? B.cur.item.name : '';
  $('#cmpOff').hidden = !on; $('#cmpRow').hidden = !on;
  $('#cmpOffset').textContent = `${B.offset >= 0 ? '+' : ''}${Math.round(B.offset * fps())} fr`;
  B.v.style.objectFit = S.fitMode;
  placeLenses();
}
// B follows A: the same time (plus the offset), playing when A plays; a drift over 60 ms is pulled back
function syncB(hard = false) {
  if (!B.cur) return;
  const want = Math.max(0, pos() + B.offset);
  if (hard || Math.abs(B.v.currentTime - want) > 0.06) {
    B.v.currentTime = want;
    if (B.mse) for (const P of Object.values(B.mse.parts)) if (!rangeAt(P.sb, want, 0)) feed(B, P, want);
  }
  if (!v.paused && B.v.paused) B.v.play().catch(() => {}); else if (v.paused && !B.v.paused) B.v.pause();
  B.v.playbackRate = v.playbackRate;
}
setInterval(() => { if (B.cur) syncB(false); }, 300);
v.addEventListener('play', () => syncB(true)); v.addEventListener('pause', () => syncB(true));
$('#cmpPick').addEventListener('click', async () => { const f = await window.api.pickOne(S.lang); if (f) setCompare(f); });
$('#cmpOff').addEventListener('click', () => setCompare(null));
$('#cmpEarlier').addEventListener('click', () => { B.offset -= 1 / fps(); applyCompare(); syncB(true); });
$('#cmpLater').addEventListener('click', () => { B.offset += 1 / fps(); applyCompare(); syncB(true); });
let wiping = false;
$('#wipe').addEventListener('pointerdown', (e) => { wiping = true; $('#wipe').setPointerCapture(e.pointerId); e.stopPropagation(); });
$('#cmp').addEventListener('pointermove', (e) => { if (!wiping) return; const r = $('#cmp').getBoundingClientRect(); $('#cmp').style.setProperty('--wipe', `${Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))}%`); });
$('#cmp').addEventListener('pointerup', () => { wiping = false; });

// ---------- Start ----------
window.api.platform().then((p) => { platform = p; document.body.classList.add(p); });
setBody('empty', true);
$('#screen').classList.add('blank');
setVolume(S.volume);
setMuted(S.muted);
v.preservesPitch = S.keepPitch;
$('#keepPitch').checked = $('#keepPitch2').checked = S.keepPitch;
$('#keepPitch2').addEventListener('input', (e) => { S.keepPitch = e.target.checked; $('#keepPitch').checked = S.keepPitch; v.preservesPitch = S.keepPitch; save(); });
$('#resume').checked = S.resume;
for (const [id, key] of [['keepQueue', 'keepQueue'], ['autoplayOpen', 'autoplayOpen'], ['keepLook', 'keepLook'], ['keepSound', 'keepSound'], ['subAuto', 'subAuto'], ['sideStart', 'sideStart'], ['bezelTop', 'bezelTop']]) {
  $('#' + id).checked = S[key];
  $('#' + id).addEventListener('input', (e) => { S[key] = e.target.checked; save(); });
}
$('#subLang').value = S.subLang; $('#subLang').addEventListener('input', (e) => { S.subLang = e.target.value.trim().toLowerCase(); save(); });
if (S.startVolume === 'full') S.volume = 1;
S.side = S.sideStart;
$('#followPic').checked = $('#followPic2').checked = S.followPic;
$('#onTop').checked = S.onTop; if (S.onTop) window.api.onTop(true);
$('#bzTop').classList.toggle('on', S.onTop);
setSpeed(S.speed);
applySubSize();
applyPicture();
applyAudio();
showSide();
showSideTab();
applyLang();
window.api.brawLook(S.brawLook);
drawFacts();
// the queue from last time, not playing by itself
queue = S.keepQueue ? fetchStore('queue', []).filter((q) => q && q.file) : [];
if (queue.length) { drawQueue(); probeQueue(); }
window.addEventListener('resize', placeLenses);
if (S.lutFile) window.api.readLut(S.lutFile).then((r) => { if (r.lut) setLut(r); });
drawMeters(); drawNotes();
