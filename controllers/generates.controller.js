import {Generates} from "../models/generates.model.js"
import { User } from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import OpenAI from 'openai'

let openaiClient
function getOpenAIClient() {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new ApiError(500, "OPENAI_API_KEY is not set")
        }
        openaiClient = new OpenAI({ apiKey })
    }
    return openaiClient
}

// Hugging Face API for image generation
async function generateImageWithHuggingFace(prompt) {
    const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
        {
            headers: { 
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    width: 1024,
                    height: 576,
                    num_inference_steps: 30,
                    guidance_scale: 8.0,
                    negative_prompt: "blurry, low quality, pixelated, grainy, dark, underexposed, overexposed, cartoon, anime, drawing, sketch, painting, abstract, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, cloned face, disfigured, out of frame, extra limbs, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, too many fingers, long neck, cross-eyed, mutated, text, watermark, signature, logo, screen, display, interface, UI, app, software, menu, button, icon, notification, status bar, home screen, lock screen, wallpaper, background image, wood, table, surface, hands, fingers, people, faces"
                }
            }),
        }
    );
    
    if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.statusText}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    return `data:image/png;base64,${base64Image}`;
}

export const creategenerate = asyncHandler(async (req, res)=>{
    const {type, input}= req.body
    if (!type || !input) {
        throw new ApiError(400, "Type and input are required")
    }

    // Check if user has enough credits
    if (req.user.creditsLeft <= 0) {
        throw new ApiError(400, "Insufficient credits. Please upgrade your plan.")
    }

    console.log('User ID:', req.user._id);
    console.log('Current credits:', req.user.creditsLeft);
    console.log('Generation type:', type);

    // DEDUCT CREDIT IMMEDIATELY - BEFORE ANY AI PROCESSING
    console.log('Deducting credit immediately for user:', req.user._id);
    const updatedUser = await User.findByIdAndUpdate(
        req.user._id, 
        { $inc: { creditsLeft: -1 } },
        { 
            new: true,
            runValidators: true
        }
    );
    
    if (!updatedUser) {
        throw new ApiError(404, 'User not found for credit deduction');
    }
    
    console.log('Credit deducted successfully. New credits:', updatedUser.creditsLeft);
    // Update req.user to reflect the new credit count
    req.user.creditsLeft = updatedUser.creditsLeft;

    const generate = await Generates.create({
        user: req.user._id,
        type,
        input,
        status: "pending"
    })

    try {
        let output
        if (type === "description"){
            const completion = await getOpenAIClient().chat.completions.create({
                model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You are an expert YouTube growth hacker. Generate catchy, SEO-rich video descriptions.",
            },
            { role: "user", content: input.title || input.prompt },
        ],
            })
            output = {
                description : completion.choices[0].message.content
            }
        }else if(type === "thumbnail"){
            const basePrompt = input.prompt || `YouTube thumbnail for ${input.title}`;
            const enhancedPrompt = `${basePrompt}, photorealistic, high quality, clear and sharp, professional product photography, studio lighting, clean white background, product isolated, no text on screen, no UI elements, no interface, just the product itself, vibrant colors, 16:9 aspect ratio, engaging composition, commercial photography style`;
            const imageUrl = await generateImageWithHuggingFace(enhancedPrompt);
            output = {
                imageUrl: imageUrl,
            };
        }else{
            throw new ApiError(400, "Invalid type. Use 'thumbnail' or 'description'");
        }
        generate.output = output;
        generate.status = "success";
        await generate.save();

        return res
            .status(201)
            .json(new ApiResponse(201, { 
                generate, 
                updatedCredits: updatedUser.creditsLeft 
            }, "Generation created successfully"));
    } catch (error) {
        generate.status = "failed";
        await generate.save();
        throw new ApiError(500, "AI generation failed: " + error.message);
    }
})

export const getAllGenerates = asyncHandler(async (req, res)=>{
    const generates = await Generates.find({user:req.user._id}).sort({createdAt:-1})
    if (!generates) {
        throw new ApiError(404, "Generates not found")
    }
    return res.status(201).json(new ApiResponse(201, generates, "Generates fetched successfully"))
})

export const getGenerateById = asyncHandler(async (req, res)=>{
    const generate = await Generates.findOne({
        _id: req.params.id,
        user: req.user._id
    })
    if (!generate) {
        throw new ApiError(404, "Generates not found")
    }
    return res.status(201).json(new ApiResponse(201, generate, "Generate fetched successfully"))
})

export const testCreditDeduction = asyncHandler(async (req, res) => {
    console.log('Test credit deduction for user:', req.user._id);
    console.log('Current credits:', req.user.creditsLeft);
    
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id, 
            { $inc: { creditsLeft: -1 } },
            { new: true }
        );
        
        if (!updatedUser) {
            throw new ApiError(404, "User not found");
        }
        
        console.log('Credit deducted successfully. New credits:', updatedUser.creditsLeft);
        
        return res.status(200).json(
            new ApiResponse(200, { 
                oldCredits: req.user.creditsLeft, 
                newCredits: updatedUser.creditsLeft 
            }, "Credit deduction test successful")
        );
    } catch (error) {
        console.error('Error in test credit deduction:', error);
        throw new ApiError(500, "Credit deduction test failed: " + error.message);
    }
})