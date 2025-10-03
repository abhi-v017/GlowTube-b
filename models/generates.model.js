import mongoose, {Schema} from "mongoose";

const generateSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["description", "thumbnail"],
        required: true
    },
    input: {
        type: Object,
        required: true
    },
    output: {
        type: Object
    },
    status: {
        type: String,
        enum: ["pending", "success", "failed"],
        default: "pending",
    },
},
{timestamps:true})

export const Generates = mongoose.model("Generates", generateSchema)