const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
  size: 'A4',
  layout: 'landscape',
  margin: 0
});

doc.pipe(fs.createWriteStream('scratch/test_sig.pdf'));

const width = doc.page.width;
const height = doc.page.height;

doc.rect(0, 0, width, height).fill('#ffffff');

const sigY = 490;
const sigW = 200;
const sigGap = (width - (sigW * 2)) / 3;

const addSigLabel = (title, x) => {
  doc.moveTo(x, sigY).lineTo(x + sigW, sigY).lineWidth(0.8).strokeColor('#cccccc').stroke();
  doc.fillColor('#002D44').font('Helvetica-Bold').fontSize(13).text(title, x, sigY + 10, { width: sigW, align: 'center' });
};

addSigLabel('Authorized Signatory', sigGap);
addSigLabel('Course Instructor', sigGap * 2 + sigW);

// Signature 1
doc.save();
const sig1X = sigGap + 20;
const sig1Y = sigY - 20;
doc.translate(sig1X, sig1Y).rotate(-2);

const drawPinkSig = (widthMult, opacityMult) => {
  doc.lineWidth(1.8 * widthMult).strokeColor('#c21e56').opacity(0.85 * opacityMult)
     .moveTo(10, 15)
     .bezierCurveTo(-10, 20, -10, -40, 15, -45) // P stem and top loop start
     .bezierCurveTo(40, -50, 45, -15, 10, -5)   // P loop close
     .bezierCurveTo(30, 0, 40, -20, 50, -10)    // loop 1
     .bezierCurveTo(60, 0, 65, -30, 75, -5)     // loop 2
     .bezierCurveTo(80, 5, 100, -15, 110, 0)    // flat curve
     .bezierCurveTo(120, 10, 130, -25, 140, -10) // tall sharp loop
     .bezierCurveTo(150, 0, 160, 10, 180, -5)   // trailing finish
     .stroke();
};
drawPinkSig(1.0, 1.0);
doc.save().opacity(0.15).translate(0.5, 0.5);
drawPinkSig(1.3, 0.5);
doc.restore();
doc.restore();

// Signature 2
doc.save();
const sig2X = sigGap * 2 + sigW + 20;
const sig2Y = sigY - 25;
doc.translate(sig2X, sig2Y).rotate(1);

const drawRedSig = (widthMult, opacityMult) => {
  doc.lineWidth(2.5 * widthMult).strokeColor('#8b0000').opacity(0.9 * opacityMult)
     .moveTo(0, 20)
     .bezierCurveTo(30, -50, 10, -60, -5, -10) // fast downstroke / loop
     .bezierCurveTo(10, 30, 40, -40, 50, -5)  
     .bezierCurveTo(60, 20, 70, -30, 80, 0)
     .bezierCurveTo(90, 10, 100, -20, 110, -5)
     .bezierCurveTo(120, 5, 140, -10, 160, 10) // fast finish
     .stroke();
  doc.lineWidth(1.5 * widthMult).moveTo(10, 25).bezierCurveTo(60, 30, 120, 20, 180, 15).stroke();
};
drawRedSig(1.0, 1.0);
doc.save().opacity(0.1).translate(-0.4, 0.4);
drawRedSig(0.8, 0.5);
doc.restore();
doc.restore();

doc.end();
