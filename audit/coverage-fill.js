/* Cards written to close a declared coverage floor, kept separate from every other
   source so it is always obvious which cards exist because the blueprint demanded
   them rather than because the evidence base produced them.

   Why this file exists. `cvs-1` — "Function of the cardiovascular system" — is a
   never-practised focus point, so the pack's own coverage rules give it a floor of
   10 cards including one written answer. It shipped with 6 and no written answer,
   and the engine rendered that failure into the live page as a yellow banner at the
   top of a student's very first load. The banner is gone (it was authoring output
   pointed at the wrong reader) and `build.mjs` now refuses to build a pack that
   fails validation — which means the gap has to be closed rather than announced.

   These are `textbook` tier and say so. They are the most basic material in the
   module, they carry a real `why:` rather than a sourcing note, and none of them
   states a figure — cvs-1 is qualitative in the course's own framing, and inventing
   a number nobody teaches is exactly the failure mode the quantity gate exists to
   catch. */
export const COVERAGE_FILL = [
  {
    type: 'flash', topic: 'cvs-anat', crit: 'cvs-1', tier: 'textbook',
    srcNote: 'Standard introductory anatomy. The course states the system’s functions but not this three-part breakdown of it.',
    q: 'What are the three components of the cardiovascular system, and what does each one contribute?',
    a: '<b>1. The heart</b> — the pump. It supplies the pressure that moves everything else. ' +
       '<b>2. The blood vessels</b> — the pipes. Arteries carry blood away from the heart, veins return it, ' +
       'and capillaries are where the actual exchange happens. <b>3. The blood</b> — the medium. ' +
       'Nothing is transported by the heart or the vessels themselves; they only move the fluid that carries it. ' +
       '<i>All three have to work for perfusion to happen — a strong pump cannot compensate for an empty circuit, ' +
       'which is the whole of hypovolaemic shock.</i>',
  },
  {
    type: 'flash', topic: 'cvs-anat', crit: 'cvs-1', tier: 'textbook',
    srcNote: 'Standard introductory anatomy, written for this pack to give the transport function something concrete to hang on.',
    q: 'The cardiovascular system transports things in both directions. Give the main things it carries TO the tissues and the main things it carries AWAY.',
    a: '<b>To the tissues:</b> oxygen (from the lungs), nutrients (from the gut), hormones (from the endocrine glands), ' +
       'and immune cells. <b>Away from the tissues:</b> carbon dioxide (to the lungs), metabolic wastes such as urea ' +
       '(to the kidneys), and heat (to the skin). ' +
       '<i>The direction is the point. A question asking what the system “delivers” and one asking what it “removes” ' +
       'are testing the same two-way traffic.</i>',
  },
  {
    type: 'mcq', topic: 'cvs-anat', crit: 'cvs-1', tier: 'textbook',
    srcNote: 'Standard introductory physiology. The course lists protection as a function without breaking it into these two halves.',
    q: 'The cardiovascular system has a protective function. This is best described as:',
    options: [
      'Clotting to seal damaged vessels, and carrying immune cells and antibodies to infection',
      'Filtering pathogens out of the blood inside the heart',
      'Producing antibodies within the plasma itself',
      'Preventing pathogens from entering the body at all',
    ],
    correct: 0,
    why: 'Protection has <b>two halves</b>: <b>clotting</b> (platelets and clotting factors seal a damaged vessel and ' +
         'stop blood loss) and <b>immunity</b> (the blood carries white cells and antibodies to wherever infection is). ' +
         'The other options put the work in the wrong place — antibodies are <i>made</i> by plasma cells in lymphoid tissue, ' +
         'not by the plasma, and keeping pathogens out in the first place is the job of the skin and mucous membranes.',
  },
  {
    type: 'saq', topic: 'cvs-anat', crit: 'cvs-1', tier: 'textbook', marks: 5,
    srcNote: 'Marking points written for this pack from the course’s own three-function framing. This is not a schedule the course publishes — self-mark it generously.',
    q: 'Explain the functions of the cardiovascular system under the headings TRANSPORT, REGULATION and PROTECTION. (5 marks)',
    points: [
      '<b>Transport — to the tissues:</b> oxygen from the lungs, nutrients from the digestive tract, and hormones from the endocrine glands',
      '<b>Transport — away from the tissues:</b> carbon dioxide to the lungs and metabolic wastes such as urea to the kidneys',
      '<b>Regulation of temperature:</b> blood carries heat from the core to the skin; vessels dilate to lose it and constrict to conserve it',
      '<b>Regulation of the internal environment:</b> distributing fluid, electrolytes and buffers keeps pH and tissue fluid volume stable',
      '<b>Protection:</b> clotting seals damaged vessels to prevent blood loss, and the blood delivers white cells and antibodies to infection',
    ],
    model: 'Any sensible split of the three headings scores. If you gave one transport point rather than two, ' +
           'give yourself the mark and add the direction you missed — the two-way traffic is the part worth remembering.',
  },
];
