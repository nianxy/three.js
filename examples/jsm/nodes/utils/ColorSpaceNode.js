import {
	LinearEncoding,
	RGBEEncoding,
	sRGBEncoding
} from '../../../../build/three.module.js';

import { TempNode } from '../core/TempNode.js';
import { FunctionNode } from '../core/FunctionNode.js';

class ColorSpaceNode extends TempNode {

	constructor( input, method ) {

		super( 'v4' );

		this.input = input;

		this.method = method || ColorSpaceNode.LINEAR_TO_LINEAR;

	}

	generate( builder, output ) {

		const input = this.input.build( builder, 'v4' );
		const outputType = this.getType( builder );

		const methodNode = ColorSpaceNode.Nodes[ this.method ];
		const method = builder.include( methodNode );

		if ( method === ColorSpaceNode.LINEAR_TO_LINEAR ) {

			return builder.format( input, outputType, output );

		} else {

			if ( methodNode.inputs.length === 2 ) {

				const factor = this.factor.build( builder, 'f' );

				return builder.format( method + '( ' + input + ', ' + factor + ' )', outputType, output );

			} else {

				return builder.format( method + '( ' + input + ' )', outputType, output );

			}

		}

	}

	fromEncoding( encoding ) {

		const components = ColorSpaceNode.getEncodingComponents( encoding );

		this.method = 'LinearTo' + components[ 0 ];
		this.factor = components[ 1 ];

	}

	fromDecoding( encoding ) {

		const components = ColorSpaceNode.getEncodingComponents( encoding );

		this.method = components[ 0 ] + 'ToLinear';
		this.factor = components[ 1 ];

	}

	copy( source ) {

		super.copy( source );

		this.input = source.input;
		this.method = source.method;

		return this;

	}

	toJSON( meta ) {

		let data = this.getJSONNode( meta );

		if ( ! data ) {

			data = this.createJSONNode( meta );

			data.input = this.input.toJSON( meta ).uuid;
			data.method = this.method;

		}

		return data;

	}

}

ColorSpaceNode.Nodes = ( function () {

	const LinearToLinear = new FunctionNode( /* glsl */`
		vec4 LinearToLinear( in vec4 value ) {

			return value;

		}`
	);

	const sRGBToLinear = new FunctionNode( /* glsl */`
		vec4 sRGBToLinear( in vec4 value ) {

			return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.w );

		}`
	);

	const LinearTosRGB = new FunctionNode( /* glsl */`
		vec4 LinearTosRGB( in vec4 value ) {

			return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.w );

		}`
	);

	const RGBEToLinear = new FunctionNode( /* glsl */`
		vec4 RGBEToLinear( in vec4 value ) {

			return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );

		}`
	);

	const LinearToRGBE = new FunctionNode( /* glsl */`
		vec4 LinearToRGBE( in vec4 value ) {

			float maxComponent = max( max( value.r, value.g ), value.b );
			float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
			return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );

		}`
	);


	return {
		LinearToLinear: LinearToLinear,
		sRGBToLinear: sRGBToLinear,
		LinearTosRGB: LinearTosRGB,
		RGBEToLinear: RGBEToLinear,
		LinearToRGBE: LinearToRGBE
	};

} )();

ColorSpaceNode.LINEAR_TO_LINEAR = 'LinearToLinear';

ColorSpaceNode.SRGB_TO_LINEAR = 'sRGBToLinear';
ColorSpaceNode.LINEAR_TO_SRGB = 'LinearTosRGB';

ColorSpaceNode.RGBE_TO_LINEAR = 'RGBEToLinear';
ColorSpaceNode.LINEAR_TO_RGBE = 'LinearToRGBE';

ColorSpaceNode.getEncodingComponents = function ( encoding ) {

	switch ( encoding ) {

		case LinearEncoding:
			return [ 'Linear' ];
		case sRGBEncoding:
			return [ 'sRGB' ];
		case RGBEEncoding:
			return [ 'RGBE' ];

	}

};

ColorSpaceNode.prototype.nodeType = 'ColorSpace';
ColorSpaceNode.prototype.hashProperties = [ 'method' ];

export { ColorSpaceNode };
